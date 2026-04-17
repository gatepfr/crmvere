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
import time
import urllib.parse
import traceback

DATABASE_URL = os.getenv('DATABASE_URL')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

def report_progress(tenant_id, step, percent):
    try:
        r = redis.from_url(REDIS_URL)
        r.set(f"tse:import:{tenant_id}:progress", percent)
        r.set(f"tse:import:{tenant_id}:step", step)
        print(f"[PROGRESS {percent}%] {step}")
    except: pass

def normalize_text(text):
    if not text: return ""
    text = str(text).upper().strip()
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def normalize_code(code):
    if not code: return "0"
    try: return str(int(float(str(code).strip())))
    except: return str(code).strip()

def find_column(columns, keywords):
    for c in columns:
        if all(k.upper() in c.upper() for k in keywords): return c
    return None

def download_and_extract(url, target_path, state_filter=None):
    print(f"Baixando: {url}")
    zip_file = os.path.join(target_path, "temp.zip")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        with requests.get(url, headers=headers, timeout=600, stream=True) as r:
            if r.status_code != 200: return False
            with open(zip_file, 'wb') as f: shutil.copyfileobj(r.raw, f)
        with zipfile.ZipFile(zip_file) as z:
            files = z.namelist()
            if state_filter:
                search_str = f"_{state_filter.upper()}.CSV"
                to_extract = [f for f in files if search_str in f.upper() or "_BRASIL.CSV" in f.upper()]
                if not to_extract: to_extract = files
            else:
                to_extract = files
            for f in to_extract: z.extract(f, target_path)
        os.remove(zip_file)
        return True
    except: return False

def safe_int(val, default=0):
    try: return int(float(str(val).strip()))
    except: return default

def geocode_address(nome, endereco, bairro, cidade, uf):
    return None, None

def process_import(ano, uf, municipio_nome, nr_candidato, tenant_id):
    print(f"--- IMPORTAÇÃO TSE V16 (ESTADO: {uf}) ---")
    tmp_dir = f"/tmp/tse_import_{tenant_id}"
    if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir, exist_ok=True)
    
    municipio_norm = normalize_text(municipio_nome)
    nr_cand_norm = normalize_code(nr_candidato)
    
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        report_progress(tenant_id, "Buscando Candidato...", 10)

        # 1. Candidato
        url_cand = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip"
        if not download_and_extract(url_cand, tmp_dir, uf):
            download_and_extract(f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip", tmp_dir, uf)

        state_files = [f for f in os.listdir(tmp_dir) if f.upper().endswith('.CSV') and 'CONSULTA_CAND' in f.upper()]
        cd_municipio_real = None
        for file in state_files:
            try:
                df = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str, on_bad_lines='skip')
                df.columns = [c.upper() for c in df.columns]
                city_col = find_column(df.columns, ['NM_UE']) or find_column(df.columns, ['NM_MUNICIPIO'])
                num_col = find_column(df.columns, ['NR_CANDIDATO'])
                if not city_col or not num_col: continue

                df['CITY_NORM'] = df[city_col].apply(normalize_text)
                df['NUM_NORM'] = df[num_col].apply(normalize_code)
                cand = df[(df['CITY_NORM'] == municipio_norm) & (df['NUM_NORM'] == nr_cand_norm)]
                
                if not cand.empty:
                    c = cand.iloc[0]
                    cd_mun_col = find_column(df.columns, ['SG_UE']) or find_column(df.columns, ['CD_UE']) or find_column(df.columns, ['CD_MUNICIPIO'])
                    cd_municipio_real = normalize_code(c[cd_mun_col])
                    sit_col = find_column(df.columns, ['DS_SITUACAO_TOT']) or find_column(df.columns, ['DS_SITUACAO']) or num_col
                    name_col = find_column(df.columns, ['NM_URNA_CANDIDATO']) or find_column(df.columns, ['NM_CANDIDATO']) or num_col
                    part_col = find_column(df.columns, ['SG_PARTIDO']) or num_col

                    cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, int(ano)))
                    cur.execute("INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)", (tenant_id, int(ano), c[name_col], c[num_col], c[part_col], cd_municipio_real, c[city_col], c[sit_col]))
                    conn.commit()
                    break
            except: continue

        if not cd_municipio_real:
            raise Exception("Candidato não encontrado.")

        # 2. Locais
        report_progress(tenant_id, "Mapeando Redutos (Bairros)...", 30)
        cur.execute("DELETE FROM tse_locais_votacao WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_municipio_real, int(ano)))
        conn.commit()
        url_locais = f"https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_{ano}.zip"
        download_and_extract(url_locais, tmp_dir)
        for file in [f for f in os.listdir(tmp_dir) if f.upper().endswith('.CSV') and 'LOCAL' in f.upper()]:
            try:
                df_l = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str)
                df_l.columns = [c.upper() for c in df_l.columns]
                c_mun_l = find_column(df_l.columns, ['CD_MUNICIPIO']) or find_column(df_l.columns, ['SG_UE'])
                locais = df_l[df_l[c_mun_l].apply(normalize_code) == cd_municipio_real].drop_duplicates(subset=['NR_ZONA', 'NR_LOCAL_VOTACAO'])
                
                bairro_col = find_column(df_l.columns, ['NM_BAIRRO']) or find_column(df_l.columns, ['NM_BAI'])
                name_loc_col = find_column(df_l.columns, ['NM_LOCAL_VOTACAO']) or find_column(df_l.columns, ['NM_LOC_VOT'])
                addr_col = find_column(df_l.columns, ['DS_ENDERECO']) or find_column(df_l.columns, ['DS_END'])

                l_data = []
                for _, r in locais.iterrows():
                    l_data.append((int(ano), cd_municipio_real, safe_int(r['NR_ZONA']), safe_int(r['NR_LOCAL_VOTACAO']), r.get(name_loc_col, 'LOCAL'), r.get(addr_col, 'ENDERECO'), r.get(bairro_col, 'NÃO INFORMADO')))
                if l_data:
                    execute_values(cur, "INSERT INTO tse_locais_votacao (ano_eleicao, cd_municipio, nr_zona, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro) VALUES %s", l_data)
                    conn.commit()
            except: continue

        # 3. Votos
        report_progress(tenant_id, "Contando Votos Oficiais...", 60)
        cur.execute("DELETE FROM tse_votos_secao WHERE cd_municipio = %s AND nr_candidato = %s AND ano_eleicao = %s", (cd_municipio_real, nr_cand_norm, int(ano)))
        url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
        if download_and_extract(url_votos, tmp_dir, uf):
            for file in [f for f in os.listdir(tmp_dir) if f.upper().endswith('.CSV') and 'SECAO' in f.upper()]:
                try:
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=100000, dtype=str)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        c_cand = find_column(chunk.columns, ['NR_VOTAVEL']) or find_column(chunk.columns, ['NR_CANDIDATO'])
                        c_mun = find_column(chunk.columns, ['CD_MUNICIPIO']) or find_column(chunk.columns, ['SG_UE'])
                        filtered = chunk[(chunk[c_mun].apply(normalize_code) == cd_municipio_real) & (chunk[c_cand].apply(normalize_code) == nr_cand_norm)]
                        if not filtered.empty:
                            v_data = [(int(ano), cd_municipio_real, safe_int(r['NR_ZONA']), safe_int(r['NR_SECAO']), safe_int(r['NR_LOCAL_VOTACAO']), nr_cand_norm, safe_int(r['QT_VOTOS'])) for _, r in filtered.iterrows()]
                            execute_values(cur, "INSERT INTO tse_votos_secao (ano_eleicao, cd_municipio, nr_zona, nr_secao, nr_local_votacao, nr_candidato, qt_votos) VALUES %s", v_data)
                            conn.commit()
                except: continue

        # 4. Perfil
        report_progress(tenant_id, "Analisando Perfil Demográfico...", 85)
        cur.execute("DELETE FROM tse_perfil_eleitorado WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_municipio_real, int(ano)))
        conn.commit()
        
        # TENTA PRIMEIRO O PERFIL POR LOCAL DE VOTAÇÃO (Mais detalhado, tem bairro)
        url_perf_local = f"https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_secao_{ano}_{uf}.zip"
        if not download_and_extract(url_perf_local, tmp_dir):
            url_perf_local = f"https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_{ano}.zip"
            download_and_extract(url_perf_local, tmp_dir)
            
        for file in [f for f in os.listdir(tmp_dir) if f.upper().endswith('.CSV') and ('PERFIL' in f.upper() or 'SECAO' in f.upper())]:
            try:
                chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=100000, dtype=str)
                for chunk in chunks:
                    chunk.columns = [c.upper() for c in chunk.columns]
                    c_mun_p = find_column(chunk.columns, ['CD_MUNICIPIO']) or find_column(chunk.columns, ['CD_UE'])
                    
                    b_p = find_column(chunk.columns, ['NM_BAIRRO']) or find_column(chunk.columns, ['NM_BAI'])
                    g_p = find_column(chunk.columns, ['DS_GENERO']) or find_column(chunk.columns, ['DS_SEXO'])
                    a_p = find_column(chunk.columns, ['DS_FAIXA_ETARIA']) or find_column(chunk.columns, ['DS_FAIXA'])
                    e_p = find_column(chunk.columns, ['DS_GRAU_ESCOLARIDADE']) or find_column(chunk.columns, ['DS_GRAU'])
                    q_p = find_column(chunk.columns, ['QT_ELEITORES_PERFIL']) or find_column(chunk.columns, ['QT_ELEITORES'])

                    f_perf = chunk[chunk[c_mun_p].apply(normalize_code) == cd_municipio_real]
                    if not f_perf.empty:
                        p_data = []
                        for _, r in f_perf.iterrows():
                            p_data.append((int(ano), cd_municipio_real, r.get(b_p, 'NÃO INFORMADO'), r.get(g_p, 'NÃO INFORMADO'), r.get(a_p, 'NÃO INFORMADO'), r.get(e_p, 'NÃO INFORMADO'), safe_int(r.get(q_p, 0))))
                        if p_data:
                            execute_values(cur, "INSERT INTO tse_perfil_eleitorado (ano_eleicao, cd_municipio, nm_bairro, ds_genero, ds_faixa_etaria, ds_grau_escolaridade, qt_eleitores) VALUES %s", p_data)
                            conn.commit()
            except: continue

        report_progress(tenant_id, "Inteligência Gerada com Sucesso!", 100)
    except Exception as e:
        if conn: conn.rollback()
        traceback.print_exc()
        report_progress(tenant_id, f"Erro: {str(e)}", 0)
    finally:
        if conn: conn.close()
        if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
