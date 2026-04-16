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
        print(f"[PROGRESS {percent}%] {step}")
    except Exception as e: print(f"Erro Redis: {e}")

def normalize_text(text):
    if not text: return ""
    text = str(text).upper().strip()
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def download_and_extract(url, target_path):
    print(f"Iniciando download: {url}")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=180, stream=True)
        if response.status_code == 200:
            print(f"Download concluído (Tamanho: {len(response.content)} bytes)")
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                print(f"Arquivos no ZIP: {z.namelist()}")
                z.extractall(target_path)
            return True
        print(f"ERRO TSE HTTP {response.status_code} para URL: {url}")
        return False
    except Exception as e:
        print(f"FALHA CRÍTICA NO DOWNLOAD: {e}")
        return False

def process_import(ano, uf, municipio_nome, nr_candidato, tenant_id):
    tmp_dir = f"/tmp/tse_import_{tenant_id}"
    if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir, exist_ok=True)
    
    municipio_norm = normalize_text(municipio_nome)
    nr_cand_str = str(nr_candidato).strip()
    
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        report_progress(tenant_id, "Iniciando processo...", 5)

        # 1. Candidato
        report_progress(tenant_id, "Buscando Candidato no TSE...", 10)
        url_cand = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip"
        found_candidato = False
        
        if download_and_extract(url_cand, tmp_dir):
            # Busca arquivos CSV ignorando case
            files = [f for f in os.listdir(tmp_dir) if f.lower().endswith('.csv') and 'consulta_cand' in f.lower()]
            print(f"CSVs de candidatos encontrados: {files}")
            
            for file in files:
                filepath = os.path.join(tmp_dir, file)
                print(f"Abrindo arquivo: {file}")
                df = pd.read_csv(filepath, sep=';', encoding='latin1', dtype=str, on_bad_lines='skip', low_memory=False)
                df.columns = [c.upper() for c in df.columns]
                
                city_col = next((c for c in ['NM_UE', 'NM_MUNICIPIO'] if c in df.columns), None)
                num_col = next((c for c in ['NR_CANDIDATO'] if c in df.columns), None)
                
                if city_col and num_col:
                    df['CITY_NORM'] = df[city_col].apply(normalize_text)
                    cand = df[(df['CITY_NORM'] == municipio_norm) & (df[num_col] == nr_cand_str)]
                    
                    if not cand.empty:
                        c = cand.iloc[0]
                        print(f"✅ CANDIDATO LOCALIZADO: {c['NM_CANDIDATO']}")
                        cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, ano))
                        cur.execute("""
                            INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (tenant_id, ano, c['NM_CANDIDATO'], c[num_col], c['SG_PARTIDO'], c['CD_MUNICIPIO'], c[city_col], c['DS_SITUACAO_CANDIDATURA']))
                        found_candidato = True
                        break

        if not found_candidato:
            print(f"Candidato {nr_candidato} não encontrado em {municipio_nome}/{uf}")
            report_progress(tenant_id, f"Não encontramos {nr_candidato} no PR em {ano}.", 0)
            return

        # 2. Locais (Bairros)
        report_progress(tenant_id, "Sincronizando Bairros...", 35)
        url_locais = f"https://cdn.tse.jus.br/estatistica/sead/odsele/rede_locais_votacao/rede_locais_votacao_{ano}_{uf}.zip"
        if download_and_extract(url_locais, tmp_dir):
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv') and 'rede_locais_votacao' in file.lower():
                    df_loc = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str, low_memory=False)
                    df_loc.columns = [c.upper() for c in df_loc.columns]
                    city_col_loc = 'NM_MUNICIPIO' if 'NM_MUNICIPIO' in df_loc.columns else 'NM_UE'
                    df_loc['CITY_NORM'] = df_loc[city_col_loc].apply(normalize_text)
                    locais = df_loc[df_loc['CITY_NORM'] == municipio_norm]
                    if not locais.empty:
                        loc_data = [(ano, r['CD_MUNICIPIO'], int(r['NR_ZONA']), int(r['NR_LOCAL_VOTACAO']), r['NM_LOCAL_VOTACAO'], r['DS_ENDERECO'], r['NM_BAIRRO'], r['NR_CEP']) for _, r in locais.iterrows()]
                        execute_values(cur, "INSERT INTO tse_locais_votacao (ano_eleicao, cd_municipio, nr_zona, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro, nr_cep) VALUES %s ON CONFLICT DO NOTHING", loc_data)

        # 3. Votos
        report_progress(tenant_id, "Minerando Votos (Última Etapa)...", 65)
        url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
        if download_and_extract(url_votos, tmp_dir):
            cur.execute("DELETE FROM tse_votos_secao WHERE ano_eleicao = %s AND nr_candidato = %s", (ano, nr_cand_str))
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv') and 'votacao_secao' in file.lower():
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=100000, dtype=str, low_memory=False)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        city_col_v = 'NM_MUNICIPIO' if 'NM_MUNICIPIO' in chunk.columns else 'NM_UE'
                        chunk['CITY_NORM'] = chunk[city_col_v].apply(normalize_text)
                        filtered = chunk[(chunk['CITY_NORM'] == municipio_norm) & (chunk['NR_VOTAVEL'] == nr_cand_str)]
                        if not filtered.empty:
                            votos_data = [(ano, r['CD_MUNICIPIO'], int(r['NR_ZONA']), int(r['NR_SECAO']), int(r['NR_LOCAL_VOTACAO']), r['NR_VOTAVEL'], int(r['QT_VOTOS'])) for _, r in filtered.iterrows()]
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
