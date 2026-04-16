import pandas as pd
import requests
import os
import sys
import psycopg2
from psycopg2.extras import execute_values
import redis
import zipfile
import io
import shutil
import unicodedata
from datetime import datetime

DATABASE_URL = os.getenv('DATABASE_URL')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

def report_progress(tenant_id, step, percent):
    try:
        r = redis.from_url(REDIS_URL)
        r.set(f"tse:import:{tenant_id}:progress", percent)
        r.set(f"tse:import:{tenant_id}:step", step)
        print(f"[{percent}%] {step}")
    except Exception as e: print(f"Erro Redis: {e}")

def normalize_text(text):
    if not text: return ""
    text = str(text).upper().strip()
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def download_and_extract(url, target_path):
    print(f"Baixando {url}...")
    try:
        response = requests.get(url, timeout=120)
        if response.status_code == 200:
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                z.extractall(target_path)
            return True
        return False
    except Exception as e:
        print(f"Erro download: {e}")
        return False

def process_import(ano, uf, municipio_nome, nr_candidato, tenant_id):
    tmp_dir = f"/tmp/tse_import_{tenant_id}"
    if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir, exist_ok=True)
    
    municipio_norm = normalize_text(municipio_nome)
    
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        report_progress(tenant_id, "Iniciando...", 5)

        # 1. Candidato
        report_progress(tenant_id, "Buscando Candidato no TSE...", 10)
        url_cand = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip"
        found_candidato = False
        if download_and_extract(url_cand, tmp_dir):
            for file in os.listdir(tmp_dir):
                if file.endswith('.csv') and 'consulta_cand' in file:
                    print(f"Analisando: {file}")
                    df = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', on_bad_lines='skip')
                    
                    # Normaliza colunas e dados
                    df.columns = [c.upper() for c in df.columns]
                    city_col = 'NM_UE' if 'NM_UE' in df.columns else 'NM_MUNICIPIO'
                    
                    if city_col not in df.columns:
                        print(f"Colunas encontradas: {df.columns.tolist()}")
                        continue

                    # Filtro ultra-flexível
                    df['CITY_NORM'] = df[city_col].apply(normalize_text)
                    df['NUM_STR'] = df['NR_CANDIDATO'].astype(str).str.strip()
                    
                    cand = df[(df['CITY_NORM'] == municipio_norm) & (df['NUM_STR'] == str(nr_candidato).strip())]
                    
                    if not cand.empty:
                        c = cand.iloc[0]
                        print(f"✅ ENCONTRADO: {c['NM_CANDIDATO']} - {c['SG_PARTIDO']}")
                        cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, ano))
                        cur.execute("""
                            INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (tenant_id, ano, c['NM_CANDIDATO'], str(c['NR_CANDIDATO']), c['SG_PARTIDO'], str(c['CD_MUNICIPIO']), c[city_col], c['DS_SITUACAO_CANDIDATURA']))
                        found_candidato = True
                        break
        
        if not found_candidato:
            print(f"❌ Não encontrado: {nr_candidato} em {municipio_norm}")
            report_progress(tenant_id, f"Candidato {nr_candidato} não localizado no TSE.", 0)
            return

        # 2. Locais de Votação
        report_progress(tenant_id, "Buscando Bairros...", 30)
        url_locais = f"https://cdn.tse.jus.br/estatistica/sead/odsele/rede_locais_votacao/rede_locais_votacao_{ano}_{uf}.zip"
        if download_and_extract(url_locais, tmp_dir):
            for file in os.listdir(tmp_dir):
                if file.endswith('.csv') and 'rede_locais_votacao' in file:
                    df = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1')
                    df.columns = [c.upper() for c in df.columns]
                    df['CITY_NORM'] = df['NM_MUNICIPIO'].apply(normalize_text)
                    locais = df[df['CITY_NORM'] == municipio_norm]
                    if not locais.empty:
                        data = [
                            (ano, str(r['CD_MUNICIPIO']), int(r['NR_ZONA']), int(r['NR_LOCAL_VOTACAO']), r['NM_LOCAL_VOTACAO'], r['DS_ENDERECO'], r['NM_BAIRRO'], str(r['NR_CEP']))
                            for _, r in locais.iterrows()
                        ]
                        execute_values(cur, "INSERT INTO tse_locais_votacao (ano_eleicao, cd_municipio, nr_zona, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro, nr_cep) VALUES %s ON CONFLICT DO NOTHING", data)

        # 3. Votos
        report_progress(tenant_id, "Minerando Votos...", 60)
        url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
        if download_and_extract(url_votos, tmp_dir):
            cur.execute("DELETE FROM tse_votos_secao WHERE cd_municipio IN (SELECT cd_municipio FROM tse_candidatos WHERE tenant_id = %s) AND nr_candidato = %s", (tenant_id, str(nr_candidato)))
            for file in os.listdir(tmp_dir):
                if file.endswith('.csv') and 'votacao_secao' in file:
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=100000)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        chunk['CITY_NORM'] = chunk['NM_MUNICIPIO'].apply(normalize_text)
                        chunk['NUM_STR'] = chunk['NR_VOTAVEL'].astype(str).str.strip()
                        filtered = chunk[(chunk['CITY_NORM'] == municipio_norm) & (chunk['NUM_STR'] == str(nr_candidato).strip())]
                        if not filtered.empty:
                            votos_data = [(ano, str(r['CD_MUNICIPIO']), int(r['NR_ZONA']), int(r['NR_SECAO']), int(r['NR_LOCAL_VOTACAO']), str(r['NR_VOTAVEL']), int(r['QT_VOTOS'])) for _, r in filtered.iterrows()]
                            execute_values(cur, "INSERT INTO tse_votos_secao (ano_eleicao, cd_municipio, nr_zona, nr_secao, nr_local_votacao, nr_candidato, qt_votos) VALUES %s", votos_data)

        conn.commit()
        report_progress(tenant_id, "Concluído!", 100)
    except Exception as e:
        if conn: conn.rollback()
        report_progress(tenant_id, f"Erro: {str(e)}", 0)
    finally:
        if conn: conn.close()
        if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
