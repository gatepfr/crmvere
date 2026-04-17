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
    except Exception as e: print(f"Erro Redis: {e}")

def normalize_text(text):
    if not text: return ""
    text = str(text).upper().strip()
    return "".join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def normalize_code(code):
    if not code: return "0"
    try:
        return str(int(float(str(code).strip())))
    except:
        return "0"

def find_column(columns, keywords):
    for c in columns:
        if all(k.upper() in c.upper() for k in keywords):
            return c
    return None

def download_and_extract(url, target_path, state_filter=None):
    print(f"Baixando: {url}")
    zip_file = os.path.join(target_path, "temp.zip")
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        with requests.get(url, headers=headers, timeout=600, stream=True) as r:
            if r.status_code != 200:
                print(f"[DOWNLOAD ERROR] Status {r.status_code} para {url}")
                return False
            with open(zip_file, 'wb') as f:
                shutil.copyfileobj(r.raw, f)
        
        with zipfile.ZipFile(zip_file) as z:
            files = z.namelist()
            search_str = f"_{state_filter.upper()}.CSV" if state_filter else None
            if search_str:
                to_extract = [f for f in files if search_str in f.upper() or "_BRASIL.CSV" in f.upper() or "LEIAME.PDF" in f.upper()]
            else:
                to_extract = files
            for f in to_extract:
                print(f"Extraindo: {f}")
                z.extract(f, target_path)
        os.remove(zip_file)
        return True
    except Exception as e:
        print(f"[ZIP ERROR] {repr(e)}")
        if os.path.exists(zip_file): os.remove(zip_file)
        return False

def safe_int(val, default=0):
    try:
        if not val or pd.isna(val): return default
        return int(float(str(val).strip()))
    except: return default

def geocode_address(nome, endereco, bairro, cidade, uf):
    queries = [f"{nome}, {cidade} - {uf}, Brasil", f"{endereco}, {bairro}, {cidade} - {uf}, Brasil"]
    for query in queries:
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1"
        try:
            headers = {'User-Agent': 'CRM-Vereador-Bot/1.0'}
            response = requests.get(url, headers=headers, timeout=10)
            data = response.json()
            if data: return data[0]['lat'], data[0]['lon']
            time.sleep(1)
        except: continue
    return None, None

def process_import(ano, uf, municipio_nome, nr_candidato, tenant_id):
    print(f"--- INICIANDO IMPORTAÇÃO TSE V4 (ESTADO: {uf}) ---")
    tmp_dir = f"/tmp/tse_import_{tenant_id}"
    if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir, exist_ok=True)
    
    if not DATABASE_URL:
        report_progress(tenant_id, "Erro: DATABASE_URL não configurada", 0)
        return

    municipio_norm = normalize_text(municipio_nome)
    nr_cand_str = str(nr_candidato).strip()
    
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        report_progress(tenant_id, "Conectando ao TSE...", 5)

        # 1. Candidato
        report_progress(tenant_id, "Buscando Candidato...", 10)
        url_state = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip"
        if not download_and_extract(url_state, tmp_dir):
            download_and_extract(f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip", tmp_dir, uf)

        all_files = os.listdir(tmp_dir)
        state_files = [f for f in all_files if f.upper().endswith('.CSV') and 'CONSULTA_CAND' in f.upper()]
        
        cd_municipio_real = None
        for file in state_files:
            print(f"Analisando: {file}")
            # Tenta múltiplos encodings
            for enc in ['latin1', 'utf-8', 'iso-8859-1']:
                try:
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding=enc, dtype=str, on_bad_lines='skip', chunksize=5000)
                    for df in chunks:
                        df.columns = [c.upper() for c in df.columns]
                        city_col = find_column(df.columns, ['NM_UE']) or find_column(df.columns, ['NM_MUNICIPIO'])
                        cd_mun_col = find_column(df.columns, ['CD_UE']) or find_column(df.columns, ['CD_MUNICIPIO'])
                        num_col = find_column(df.columns, ['NR_CANDIDATO'])
                        
                        if not city_col or not num_col: continue

                        df['CITY_NORM'] = df[city_col].apply(normalize_text)
                        cand = df[(df['CITY_NORM'] == municipio_norm) & (df[num_col] == nr_cand_str)]
                        if not cand.empty:
                            c = cand.iloc[0]
                            cd_municipio_real = normalize_code(c[cd_mun_col])
                            cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, ano))
                            cur.execute("""
                                INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (tenant_id, ano, c[find_column(df.columns, ['NM_CANDIDATO'])], c[num_col], c[find_column(df.columns, ['SG_PARTIDO'])], cd_municipio_real, c[city_col], c[find_column(df.columns, ['DS_SITUACAO_TOT_TURNO'])]))
                            break
                    if cd_municipio_real: break
                except: continue
            if cd_municipio_real: break

        if not cd_municipio_real:
            raise Exception(f"Candidato {nr_cand_str} não encontrado no arquivo do TSE para {municipio_nome}-{uf}. Verifique os dados.")

        # LIMPEZA PREVENTIVA
        cur.execute("DELETE FROM tse_locais_votacao WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_municipio_real, ano))
        cur.execute("DELETE FROM tse_votos_secao WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_municipio_real, ano))
        cur.execute("DELETE FROM tse_perfil_eleitorado WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_municipio_real, ano))
        conn.commit()

        # 2. Locais
        report_progress(tenant_id, "Mapeando Locais de Votação...", 30)
        url_locais = f"https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_{ano}.zip"
        if download_and_extract(url_locais, tmp_dir, uf):
            for file in [f for f in os.listdir(tmp_dir) if f.upper().endswith('.CSV')]:
                try:
                    df_l = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str)
                    df_l.columns = [c.upper() for c in df_l.columns]
                    cd_mun_l = find_column(df_l.columns, ['CD_MUNICIPIO'])
                    locais = df_l[df_l[cd_mun_l].apply(normalize_code) == cd_municipio_real].drop_duplicates(subset=['NR_ZONA', 'NR_LOCAL_VOTACAO'])
                    for _, r in locais.iterrows():
                        lat, lng = geocode_address(r['NM_LOCAL_VOTACAO'], r['DS_ENDERECO'], r['NM_BAIRRO'], municipio_nome, uf)
                        cur.execute("INSERT INTO tse_locais_votacao VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)", (ano, cd_municipio_real, safe_int(r['NR_ZONA']), safe_int(r['NR_LOCAL_VOTACAO']), r['NM_LOCAL_VOTACAO'], r['DS_ENDERECO'], r['NM_BAIRRO'], lat, lng))
                    conn.commit()
                except: continue

        # 3. Votos
        report_progress(tenant_id, "Contando Votos Oficiais...", 60)
        url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
        if download_and_extract(url_votos, tmp_dir):
            for file in [f for f in os.listdir(tmp_dir) if f.upper().endswith('.CSV')]:
                try:
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=20000, dtype=str)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        c_cand = find_column(chunk.columns, ['NR_VOTAVEL']) or find_column(chunk.columns, ['NR_CANDIDATO'])
                        c_mun = find_column(chunk.columns, ['CD_MUNICIPIO'])
                        filtered = chunk[(chunk[c_mun].apply(normalize_code) == cd_municipio_real) & (chunk[c_cand] == nr_cand_str)]
                        if not filtered.empty:
                            v_data = [(ano, cd_municipio_real, safe_int(r['NR_ZONA']), safe_int(r['NR_SECAO']), safe_int(r['NR_LOCAL_VOTACAO']), nr_cand_str, safe_int(r['QT_VOTOS'])) for _, r in filtered.iterrows()]
                            execute_values(cur, "INSERT INTO tse_votos_secao VALUES %s", v_data)
                    conn.commit()
                except: continue

        # 4. Perfil
        report_progress(tenant_id, "Analisando Perfil Demográfico...", 85)
        url_perf = f"https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_{ano}.zip"
        if download_and_extract(url_perf, tmp_dir, uf):
            for file in [f for f in os.listdir(tmp_dir) if f.upper().endswith('.CSV')]:
                try:
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=20000, dtype=str)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        c_mun = find_column(chunk.columns, ['CD_MUNICIPIO'])
                        f_perf = chunk[chunk[c_mun].apply(normalize_code) == cd_municipio_real]
                        if not f_perf.empty:
                            p_data = [(ano, cd_municipio_real, r.get('NM_BAIRRO', 'NÃO INFORMADO'), r.get('DS_GENERO', 'NÃO INFORMADO'), r.get('DS_FAIXA_ETARIA', 'NÃO INFORMADO'), r.get('DS_GRAU_ESCOLARIDADE', 'NÃO INFORMADO'), safe_int(r.get('QT_ELEITORES_PERFIL', 0))) for _, r in f_perf.iterrows()]
                            execute_values(cur, "INSERT INTO tse_perfil_eleitorado VALUES %s", p_data)
                    conn.commit()
                except: continue

        report_progress(tenant_id, "Inteligência Gerada com Sucesso!", 100)
    except Exception as e:
        traceback.print_exc()
        report_progress(tenant_id, f"Erro: {repr(e)}", 0)
    finally:
        if conn: conn.close()
        if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
