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
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        with requests.get(url, headers=headers, timeout=600, stream=True) as r:
            if r.status_code != 200:
                print(f"[DOWNLOAD ERROR] Status {r.status_code} para {url}")
                return False
            with open(zip_file, 'wb') as f:
                shutil.copyfileobj(r.raw, f)
        
        with zipfile.ZipFile(zip_file) as z:
            files = z.namelist()
            to_extract = [f for f in files if not state_filter or f"_{state_filter.upper()}.csv" in f.upper()]
            if not to_extract: to_extract = files
            for f in to_extract:
                print(f"Extraindo: {f}")
                z.extract(f, target_path)
        
        os.remove(zip_file)
        return True
    except Exception as e:
        print(f"[ZIP ERROR] {str(e)}")
        if os.path.exists(zip_file): os.remove(zip_file)
        return False

def safe_int(val, default=0):
    try:
        if not val or pd.isna(val): return default
        return int(float(str(val).strip()))
    except: return default

def geocode_address(nome, endereco, bairro, cidade, uf):
    # Tentativa 1: Nome do Local + Cidade
    queries = [
        f"{nome}, {cidade} - {uf}, Brasil",
        f"{endereco}, {bairro}, {cidade} - {uf}, Brasil",
        f"{endereco}, {cidade} - {uf}, Brasil"
    ]
    
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
    print(f"--- INICIANDO IMPORTAÇÃO TSE V3 (ESTADO: {uf}) ---")
    tmp_dir = f"/tmp/tse_import_{tenant_id}"
    if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)
    os.makedirs(tmp_dir, exist_ok=True)
    
    if not DATABASE_URL:
        msg = "Erro: Variável DATABASE_URL não encontrada no ambiente"
        report_progress(tenant_id, msg, 0)
        print(f"[CRITICAL] {msg}")
        sys.exit(1)

    municipio_norm = normalize_text(municipio_nome)
    nr_cand_str = str(nr_candidato).strip()
    
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        report_progress(tenant_id, "Conectando ao TSE...", 5)

        # 1. Candidato
        report_progress(tenant_id, "Buscando Candidato...", 10)
        
        # Tenta primeiro o arquivo do estado (UF) que é muito menor
        url_state = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip"
        url_br = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip"
        
        print(f"Tentando baixar dados do estado: {url_state}")
        success = download_and_extract(url_state, tmp_dir)
        
        if not success:
            print("Arquivo do estado não encontrado ou falhou, tentando arquivo nacional (pesado)...")
            success = download_and_extract(url_br, tmp_dir, uf)
            
        if not success:
            raise Exception("Não foi possível baixar os dados de candidatos do TSE (URL indisponível ou erro de rede)")

        # FILTRO CRÍTICO: Processa apenas o arquivo do estado selecionado para não estourar a RAM
        all_files = os.listdir(tmp_dir)
        print(f"Arquivos no diretório temporário: {all_files}")
        
        target_pattern = f"CONSULTA_CAND_2024_{uf.upper()}.CSV"
        state_files = [f for f in all_files if f.upper().endswith('.CSV') and (uf.upper() in f.upper() or 'BRASIL' in f.upper())]
        
        if not state_files:
            # Tenta busca mais flexível se a exata falhar
            state_files = [f for f in all_files if f.upper().endswith('.CSV') and 'CONSULTA_CAND' in f.upper()]
            
        if not state_files:
            raise Exception(f"Nenhum arquivo CSV de candidatos encontrado em {tmp_dir}. Arquivos presentes: {all_files}")

        print(f"Arquivos selecionados para análise: {state_files}")
        cd_municipio_real = None
        for file in state_files:
            print(f"Analisando conteúdo de: {file}")
            # Lê em chunks para economizar memória
            try:
                chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str, on_bad_lines='skip', chunksize=10000)
                
                for df in chunks:
                    df.columns = [c.upper() for c in df.columns]
                    # Log das colunas apenas no primeiro chunk do primeiro arquivo para depurar
                    if cd_municipio_real is None and file == state_files[0]:
                        print(f"Colunas encontradas: {list(df.columns)[:10]}...")

                    city_col = find_column(df.columns, ['NM', 'MUN']) or find_column(df.columns, ['NM', 'UE'])
                    cd_mun_col = find_column(df.columns, ['CD', 'MUN']) or find_column(df.columns, ['CD', 'UE'])
                    num_col = find_column(df.columns, ['NR', 'CANDIDATO'])
                    
                    if city_col and num_col:
                        df['CITY_NORM'] = df[city_col].apply(normalize_text)
                        cand = df[(df['CITY_NORM'] == municipio_norm) & (df[num_col] == nr_cand_str)]
                        if not cand.empty:
                            c = cand.iloc[0]
                            cd_municipio_real = normalize_code(c[cd_mun_col])
                            print(f"Candidato encontrado! Município: {c[city_col]} (Código: {cd_municipio_real})")
                            cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, ano))
                            cur.execute("""
                                INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """, (tenant_id, ano, c[find_column(df.columns, ['NM', 'CANDIDATO'])], c[num_col], c[find_column(df.columns, ['SG', 'PARTIDO'])], cd_municipio_real, c[city_col], c[find_column(df.columns, ['DS', 'SITUACAO', 'TOT'])]))
                            break
                if cd_municipio_real: break
            except Exception as e:
                print(f"Erro ao ler arquivo {file}: {str(e)}")
                continue

        if not cd_municipio_real:
            report_progress(tenant_id, f"Candidato {nr_cand_str} não encontrado em {municipio_nome}-{uf}.", 0)
            return

        # LIMPEZA PREVENTIVA (Evita duplicar ao reimportar)
        cur.execute("DELETE FROM tse_locais_votacao WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_municipio_real, ano))
        cur.execute("DELETE FROM tse_votos_secao WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_municipio_real, ano))
        cur.execute("DELETE FROM tse_perfil_eleitorado WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_municipio_real, ano))
        conn.commit()

        # 2. Locais e Coordenadas
        report_progress(tenant_id, "Mapeando Locais de Votação...", 30)
        for f in os.listdir(tmp_dir): os.remove(os.path.join(tmp_dir, f))
        url_locais = f"https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_{ano}.zip"
        if download_and_extract(url_locais, tmp_dir, uf):
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv'):
                    df_l = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str)
                    df_l.columns = [c.upper() for c in df_l.columns]
                    cd_mun_l = find_column(df_l.columns, ['CD', 'MUN'])
                    if not cd_mun_l: continue
                    
                    locais = df_l[df_l[cd_mun_l].apply(normalize_code) == cd_municipio_real].copy()
                    locais = locais.drop_duplicates(subset=['NR_ZONA', 'NR_LOCAL_VOTACAO'])
                    
                    for _, r in locais.iterrows():
                        lat, lng = geocode_address(r['NM_LOCAL_VOTACAO'], r['DS_ENDERECO'], r['NM_BAIRRO'], municipio_nome, uf)
                        cur.execute("""
                            INSERT INTO tse_locais_votacao (ano_eleicao, cd_municipio, nr_zona, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro, latitude, longitude)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (ano, cd_municipio_real, safe_int(r['NR_ZONA']), safe_int(r['NR_LOCAL_VOTACAO']), r['NM_LOCAL_VOTACAO'], r['DS_ENDERECO'], r['NM_BAIRRO'], lat, lng))
            conn.commit()

        # 3. Votos por Seção
        report_progress(tenant_id, "Contando Votos Oficiais...", 60)
        for f in os.listdir(tmp_dir): os.remove(os.path.join(tmp_dir, f))
        url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
        if download_and_extract(url_votos, tmp_dir):
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv'):
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=50000, dtype=str)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        c_cand = find_column(chunk.columns, ['NR', 'VOTAVEL']) or find_column(chunk.columns, ['NR', 'CANDIDATO'])
                        c_mun = find_column(chunk.columns, ['CD', 'MUN'])
                        
                        filtered = chunk[(chunk[c_mun].apply(normalize_code) == cd_municipio_real) & (chunk[c_cand] == nr_cand_str)]
                        if not filtered.empty:
                            v_data = [(ano, cd_municipio_real, safe_int(r['NR_ZONA']), safe_int(r['NR_SECAO']), safe_int(r['NR_LOCAL_VOTACAO']), nr_cand_str, safe_int(r['QT_VOTOS'])) for _, r in filtered.iterrows()]
                            execute_values(cur, "INSERT INTO tse_votos_secao (ano_eleicao, cd_municipio, nr_zona, nr_secao, nr_local_votacao, nr_candidato, qt_votos) VALUES %s", v_data)
            conn.commit()

        # 4. Perfil Eleitorado (Gênero, Idade, Escolaridade)
        report_progress(tenant_id, "Analisando Perfil Demográfico...", 85)
        for f in os.listdir(tmp_dir): os.remove(os.path.join(tmp_dir, f))
        url_perf = f"https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_{ano}.zip"
        if download_and_extract(url_perf, tmp_dir):
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv'):
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=50000, dtype=str)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        c_mun = find_column(chunk.columns, ['CD', 'MUN'])
                        c_gen = find_column(chunk.columns, ['DS', 'GENERO']) or find_column(chunk.columns, ['DS', 'SEXO'])
                        c_esc = find_column(chunk.columns, ['DS', 'GRAU', 'ESCOLARIDADE'])
                        c_ida = find_column(chunk.columns, ['DS', 'FAIXA', 'ETARIA'])
                        c_bairro = find_column(chunk.columns, ['NM', 'BAIRRO'])
                        c_qt = find_column(chunk.columns, ['QT', 'ELEITORES'])

                        f_perf = chunk[chunk[c_mun].apply(normalize_code) == cd_municipio_real]
                        if not f_perf.empty:
                            p_data = [(ano, cd_municipio_real, r.get(c_bairro, 'NÃO INFORMADO'), r.get(c_gen, 'NÃO INFORMADO'), r.get(c_ida, 'NÃO INFORMADO'), r.get(c_esc, 'NÃO INFORMADO'), safe_int(r.get(c_qt, 0))) for _, r in f_perf.iterrows()]
                            execute_values(cur, "INSERT INTO tse_perfil_eleitorado (ano_eleicao, cd_municipio, nm_bairro, ds_genero, ds_faixa_etaria, ds_grau_escolaridade, qt_eleitores) VALUES %s", p_data)
            conn.commit()

        report_progress(tenant_id, "Inteligência Gerada com Sucesso!", 100)
    except Exception as e:
        err_msg = str(e) if str(e) else "Erro desconhecido no processamento"
        report_progress(tenant_id, f"Erro: {err_msg}", 0)
        print(f"[ERROR] {err_msg}")
        sys.exit(1)
    finally:
        if conn: conn.close()
        if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
