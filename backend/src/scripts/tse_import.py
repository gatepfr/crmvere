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
import traceback
from datetime import datetime

DATABASE_URL = os.getenv('DATABASE_URL')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

def report_progress(tenant_id, step, percent):
    try:
        r = redis.from_url(REDIS_URL)
        r.set(f"tse:import:{tenant_id}:progress", percent)
        r.set(f"tse:import:{tenant_id}:step", step)
        print(f"[PROGRESS {percent}%] {step}")
    except Exception as e: 
        print(f"Erro Redis: {e}")

def normalize_text(text):
    if not text: return ""
    text = str(text).upper().strip()
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def find_column(columns, keywords, mandatory=True):
    for c in columns:
        if all(k.upper() in c.upper() for k in keywords):
            return c
    if mandatory:
        raise ValueError(f"Coluna obrigatória não encontrada. Procurando por: {keywords}. Colunas disponíveis: {list(columns)[:10]}...")
    return None

def download_and_extract(url, target_path, state_filter=None):
    print(f"Baixando: {url}")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=300, stream=True)
        if response.status_code == 200:
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                files = z.namelist()
                to_extract = [f for f in files if not state_filter or f"_{state_filter.upper()}.csv" in f.upper()]
                if not to_extract: to_extract = files
                for f in to_extract: z.extract(f, target_path)
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
    nr_cand_str = str(nr_candidato).strip()
    
    conn = None
    try:
        print(f"Conectando ao banco...")
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        report_progress(tenant_id, "Iniciando processamento...", 5)

        # 1. Candidato
        report_progress(tenant_id, "Buscando Candidato no TSE...", 10)
        url_cand = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip"
        if not download_and_extract(url_cand, tmp_dir, uf):
            download_and_extract(f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip", tmp_dir)

        files = [f for f in os.listdir(tmp_dir) if f.lower().endswith('.csv') and 'consulta_cand' in f.lower()]
        found_candidato = False
        for file in files:
            df = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str, on_bad_lines='skip', low_memory=False)
            df.columns = [c.upper() for c in df.columns]
            
            city_col = find_column(df.columns, ['NM', 'MUN'], False) or find_column(df.columns, ['NM', 'UE'], False)
            num_col = find_column(df.columns, ['NR', 'CANDIDATO'])
            cd_mun_col = find_column(df.columns, ['CD', 'MUN'], False) or find_column(df.columns, ['CD', 'UE'], False)

            if city_col and num_col:
                df['CITY_NORM'] = df[city_col].apply(normalize_text)
                cand = df[(df['CITY_NORM'] == municipio_norm) & (df[num_col] == nr_cand_str)]
                if not cand.empty:
                    c = cand.iloc[0]
                    cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, ano))
                    cur.execute("""
                        INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (tenant_id, ano, c['NM_CANDIDATO'], c[num_col], c['SG_PARTIDO'], c[cd_mun_col], c[city_col], c['DS_SITUACAO_CANDIDATURA']))
                    found_candidato = True
                    break

        if not found_candidato:
            report_progress(tenant_id, f"Candidato {nr_cand_str} não encontrado em {municipio_nome}.", 0)
            return

        # 2. Locais
        report_progress(tenant_id, "Minerando Bairros...", 35)
        url_locais = f"https://cdn.tse.jus.br/estatistica/sead/odsele/rede_locais_votacao/rede_locais_votacao_{ano}.zip"
        if not download_and_extract(url_locais, tmp_dir, uf):
            download_and_extract(f"https://cdn.tse.jus.br/estatistica/sead/odsele/rede_locais_votacao/rede_locais_votacao_{ano}_{uf}.zip", tmp_dir)
        
        for file in os.listdir(tmp_dir):
            if file.lower().endswith('.csv') and 'rede_locais_votacao' in file.lower():
                df_loc = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str)
                df_loc.columns = [c.upper() for c in df_loc.columns]
                c_city = find_column(df_loc.columns, ['NM', 'MUN'])
                c_code = find_column(df_loc.columns, ['CD', 'MUN'])
                df_loc['CITY_NORM'] = df_loc[c_city].apply(normalize_text)
                locais = df_loc[df_loc['CITY_NORM'] == municipio_norm]
                if not locais.empty:
                    loc_data = [(ano, r[c_code], int(r['NR_ZONA']), int(r['NR_LOCAL_VOTACAO']), r['NM_LOCAL_VOTACAO'], r['DS_ENDERECO'], r['NM_BAIRRO'], r['NR_CEP']) for _, r in locais.iterrows()]
                    execute_values(cur, "INSERT INTO tse_locais_votacao (ano_eleicao, cd_municipio, nr_zona, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro, nr_cep) VALUES %s ON CONFLICT DO NOTHING", loc_data)

        # 3. Votos
        report_progress(tenant_id, "Minerando Votos...", 65)
        url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
        if download_and_extract(url_votos, tmp_dir):
            cur.execute("DELETE FROM tse_votos_secao WHERE ano_eleicao = %s AND nr_candidato = %s", (ano, nr_cand_str))
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv') and 'votacao_secao' in file.lower():
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=100000, dtype=str)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        c_city_v = find_column(chunk.columns, ['NM', 'MUN'])
                        c_code_v = find_column(chunk.columns, ['CD', 'MUN'], False) or find_column(chunk.columns, ['CD', 'UE'], False)
                        chunk['CITY_NORM'] = chunk[c_city_v].apply(normalize_text)
                        filtered = chunk[(chunk['CITY_NORM'] == municipio_norm) & (chunk['NR_VOTAVEL'] == nr_cand_str)]
                        if not filtered.empty:
                            votos_data = [(ano, r[c_code_v], int(r['NR_ZONA']), int(r['NR_SECAO']), int(r['NR_LOCAL_VOTACAO']), r['NR_VOTAVEL'], int(r['QT_VOTOS'])) for _, r in filtered.iterrows()]
                            execute_values(cur, "INSERT INTO tse_votos_secao (ano_eleicao, cd_municipio, nr_zona, nr_secao, nr_local_votacao, nr_candidato, qt_votos) VALUES %s", votos_data)

        conn.commit()
        report_progress(tenant_id, "Importação Concluída com Sucesso!", 100)
    except Exception as e:
        if conn: conn.rollback()
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"ERRO FATAL: {error_msg}")
        traceback.print_exc()
        report_progress(tenant_id, f"Falha: {error_msg}", 0)
    finally:
        if conn: conn.close()
        if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    if len(sys.argv) < 6:
        sys.exit(1)
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
