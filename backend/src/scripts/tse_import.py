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

def download_and_extract(url, target_path, state_filter=None):
    print(f"Baixando: {url}")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=300, stream=True)
        if response.status_code == 200:
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                # Se houver filtro de estado, só extraímos o arquivo do estado
                # Senão, extraímos tudo
                files_to_extract = [f for f in z.namelist() if not state_filter or f"_{state_filter}.csv" in f.upper()]
                if not files_to_extract:
                    files_to_extract = z.namelist() # fallback
                
                print(f"Extraindo: {files_to_extract}")
                for f in files_to_extract:
                    z.extract(f, target_path)
            return True
        print(f"Erro TSE HTTP {response.status_code}")
        return False
    except Exception as e:
        print(f"Falha de conexão: {e}")
        return False

def process_import(ano, uf, municipio_nome, nr_candidato, tenant_id):
    tmp_dir = f"/tmp/tse_import_{tenant_id}"
    if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir, exist_ok=True)
    
    uf = uf.upper()
    municipio_norm = normalize_text(municipio_nome)
    nr_cand_str = str(nr_candidato).strip()
    
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        report_progress(tenant_id, "Iniciando conexão...", 5)

        # 1. Candidato - Em 2024 é um ZIP nacional
        report_progress(tenant_id, "Buscando candidatos (Base Nacional)...", 10)
        url_cand = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip"
        found_candidato = False
        
        # Tenta baixar o nacional (padrão 2024), se falhar tenta o por estado (padrão 2020)
        if not download_and_extract(url_cand, tmp_dir, uf):
            url_cand_state = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip"
            download_and_extract(url_cand_state, tmp_dir)

        files = [f for f in os.listdir(tmp_dir) if f.lower().endswith('.csv') and 'consulta_cand' in f.lower()]
        for file in files:
            filepath = os.path.join(tmp_dir, file)
            df = pd.read_csv(filepath, sep=';', encoding='latin1', dtype=str, on_bad_lines='skip', low_memory=False)
            df.columns = [c.upper() for c in df.columns]
            
            city_col = next((c for c in ['NM_UE', 'NM_MUNICIPIO'] if c in df.columns), None)
            num_col = 'NR_CANDIDATO'
            
            if city_col and num_col in df.columns:
                df['CITY_NORM'] = df[city_col].apply(normalize_text)
                cand = df[(df['CITY_NORM'] == municipio_norm) & (df[num_col] == nr_cand_str)]
                
                if not cand.empty:
                    c = cand.iloc[0]
                    print(f"✅ Candidato {c['NM_CANDIDATO']} localizado!")
                    cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, ano))
                    cur.execute("""
                        INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (tenant_id, ano, c['NM_CANDIDATO'], c[num_col], c['SG_PARTIDO'], c['CD_MUNICIPIO'], c[city_col], c['DS_SITUACAO_CANDIDATURA']))
                    found_candidato = True
                    break

        if not found_candidato:
            report_progress(tenant_id, "Candidato não encontrado no arquivo do TSE.", 0)
            return

        # 2. Locais (Bairros) - Também nacional em 2024
        report_progress(tenant_id, "Mapeando Bairros (Base Nacional)...", 35)
        url_locais = f"https://cdn.tse.jus.br/estatistica/sead/odsele/rede_locais_votacao/rede_locais_votacao_{ano}.zip"
        if not download_and_extract(url_locais, tmp_dir, uf):
            url_locais_state = f"https://cdn.tse.jus.br/estatistica/sead/odsele/rede_locais_votacao/rede_locais_votacao_{ano}_{uf}.zip"
            download_and_extract(url_locais_state, tmp_dir)

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

        # 3. Votos - Este costuma ser por estado
        report_progress(tenant_id, "Sincronizando votos (Fase Pesada)...", 65)
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
