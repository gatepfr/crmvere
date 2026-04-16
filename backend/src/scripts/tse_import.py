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

def normalize_code(code):
    if not code: return ""
    return str(code).strip().lstrip('0')

def find_column(columns, keywords):
    for c in columns:
        if all(k.upper() in c.upper() for k in keywords):
            return c
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
        print(f"Erro HTTP {response.status_code} ao baixar {url}")
        return False
    except Exception as e:
        print(f"Erro download: {e}")
        return False

def safe_int(val, default=0):
    try:
        if not val or pd.isna(val): return default
        return int(float(str(val).strip()))
    except:
        return default

def clean_tse_value(text):
    if not text: return "NÃO INFORMADO"
    text = str(text).replace("#", "").strip().upper()
    mapping = {
        "NE": "NÃO ELEITO",
        "NULO": "NÃO INFORMADO",
        "NI": "NÃO INFORMADO"
    }
    return mapping.get(text, text)

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
        report_progress(tenant_id, "Iniciando conexão...", 5)

        # 1. Candidato
        report_progress(tenant_id, "Buscando Candidato...", 10)
        url_cand = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip"
        if not download_and_extract(url_cand, tmp_dir, uf):
            download_and_extract(f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip", tmp_dir)

        files = [f for f in os.listdir(tmp_dir) if f.lower().endswith('.csv') and 'consulta_cand' in f.lower()]
        found_candidato = False
        cd_municipio_candidato = None

        for file in files:
            df = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str, on_bad_lines='skip', low_memory=False)
            df.columns = [c.upper() for c in df.columns]
            city_col = find_column(df.columns, ['NM', 'MUN']) or find_column(df.columns, ['NM', 'UE'])
            num_col = find_column(df.columns, ['NR', 'CANDIDATO'])
            cd_mun_col = find_column(df.columns, ['CD', 'MUN']) or find_column(df.columns, ['SG', 'UE']) or find_column(df.columns, ['CD', 'UE'])
            
            # Prioriza a situação final (Eleito/Suplente) se disponível, senão pega a de candidatura (Deferido)
            sit_col = find_column(df.columns, ['DS', 'SITUACAO', 'TOTALIZACAO']) or \
                      find_column(df.columns, ['DS', 'SIT', 'TOT']) or \
                      find_column(df.columns, ['DS', 'SITUACAO', 'CANDIDATURA']) or \
                      find_column(df.columns, ['DS', 'SIT'])
            
            name_col = find_column(df.columns, ['NM', 'CANDIDATO'])
            part_col = find_column(df.columns, ['SG', 'PARTIDO'])

            if city_col and num_col and cd_mun_col:
                df['CITY_NORM'] = df[city_col].apply(normalize_text)
                cand = df[(df['CITY_NORM'] == municipio_norm) & (df[num_col] == nr_cand_str)]
                if not cand.empty:
                    c = cand.iloc[0]
                    cd_municipio_candidato = normalize_code(c[cd_mun_col])
                    
                    # Limpa siglas como #NE# e traduz para texto amigável
                    status_limpo = clean_tse_value(c.get(sit_col, "NÃO INFORMADO"))
                    
                    cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, ano))
                    cur.execute("""
                        INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (tenant_id, ano, c[name_col], c[num_col], c[part_col], cd_municipio_candidato, c[city_col], status_limpo))
                    found_candidato = True
                    break

        if not found_candidato:
            report_progress(tenant_id, "Candidato não encontrado no município informado.", 0)
            return

        # 2. Locais (Bairros)
        report_progress(tenant_id, "Minerando Bairros...", 30)
        for f in os.listdir(tmp_dir): os.remove(os.path.join(tmp_dir, f))
        
        # Tenta URL antiga (2020) e nova (2024)
        urls_locais = [
            f"https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_{ano}.zip",
            f"https://cdn.tse.jus.br/estatistica/sead/odsele/rede_locais_votacao/rede_locais_votacao_{ano}.zip"
        ]
        
        locais_baixados = False
        for url in urls_locais:
            if download_and_extract(url, tmp_dir, uf):
                locais_baixados = True
                break
            # Tenta também a versão com UF no nome do ZIP caso a global falhe
            if download_and_extract(url.replace(".zip", f"_{uf}.zip"), tmp_dir):
                locais_baixados = True
                break

        if locais_baixados:
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv') and any(x in file.lower() for x in ['rede_locais_votacao', 'local_votacao', 'eleitorado_local_votacao']):
                    df_loc = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', dtype=str)
                    df_loc.columns = [c.upper() for c in df_loc.columns]
                    c_city = find_column(df_loc.columns, ['NM', 'MUN']) or find_column(df_loc.columns, ['NM', 'UE'])
                    c_code = find_column(df_loc.columns, ['CD', 'MUN']) or find_column(df_loc.columns, ['CD', 'UE'])
                    c_zona = find_column(df_loc.columns, ['NR', 'ZONA'])
                    c_local = find_column(df_loc.columns, ['NR', 'LOCAL', 'VOTACAO']) or find_column(df_loc.columns, ['NR', 'LOCAL'])
                    c_name_loc = find_column(df_loc.columns, ['NM', 'LOCAL', 'VOTACAO']) or find_column(df_loc.columns, ['NM', 'LOCAL'])
                    c_bairro = find_column(df_loc.columns, ['NM', 'BAIRRO'])
                    c_end = find_column(df_loc.columns, ['DS', 'ENDERECO'])
                    c_cep = find_column(df_loc.columns, ['NR', 'CEP'])
                    
                    df_loc['CITY_NORM'] = df_loc[c_city].apply(normalize_text)
                    locais = df_loc[df_loc['CITY_NORM'] == municipio_norm].copy()

                    if not locais.empty:
                        # GARANTE QUE CADA LOCAL DE VOTAÇÃO SEJA ÚNICO (Remove duplicatas de seções)
                        locais = locais.drop_duplicates(subset=[c_code, c_zona, c_local])

                        loc_data = []
                        for _, r in locais.iterrows():

                            loc_data.append((
                                ano, 
                                normalize_code(r[c_code]), 
                                safe_int(r.get(c_zona, 0)), 
                                safe_int(r.get(c_local, 0)), 
                                r.get(c_name_loc, 'SEM NOME'), 
                                r.get(c_end, ''), 
                                r.get(c_bairro, 'NÃO INFORMADO'), 
                                r.get(c_cep, '')
                            ))
                        execute_values(cur, "INSERT INTO tse_locais_votacao (ano_eleicao, cd_municipio, nr_zona, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro, nr_cep) VALUES %s ON CONFLICT DO NOTHING", loc_data)

        # 3. Votos
        report_progress(tenant_id, "Contabilizando Votos...", 60)
        for f in os.listdir(tmp_dir): os.remove(os.path.join(tmp_dir, f))
        
        url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
        if download_and_extract(url_votos, tmp_dir):
            cur.execute("DELETE FROM tse_votos_secao WHERE ano_eleicao = %s AND nr_candidato = %s AND cd_municipio = %s", (ano, nr_cand_str, cd_municipio_candidato))
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv') and 'votacao_secao' in file.lower():
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=100000, dtype=str)
                    for chunk in chunks:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        c_city_v = find_column(chunk.columns, ['NM', 'MUN']) or find_column(chunk.columns, ['NM', 'UE'])
                        c_code_v = find_column(chunk.columns, ['CD', 'MUN']) or find_column(chunk.columns, ['CD', 'UE'])
                        c_zona_v = find_column(chunk.columns, ['NR', 'ZONA'])
                        c_secao_v = find_column(chunk.columns, ['NR', 'SECAO'])
                        c_local_v = find_column(chunk.columns, ['NR', 'LOCAL', 'VOTACAO']) or find_column(chunk.columns, ['NR', 'LOCAL'])
                        c_cand_v = find_column(chunk.columns, ['NR', 'VOTAVEL']) or find_column(chunk.columns, ['NR', 'CANDIDATO'])
                        c_qt_v = find_column(chunk.columns, ['QT', 'VOTOS'])
                        
                        if not c_city_v or not c_cand_v: continue

                        chunk['CITY_NORM'] = chunk[c_city_v].apply(normalize_text)
                        filtered = chunk[(chunk['CITY_NORM'] == municipio_norm) & (chunk[c_cand_v] == nr_cand_str)]
                        if not filtered.empty:
                            votos_data = []
                            for _, r in filtered.iterrows():
                                votos_data.append((
                                    ano, 
                                    normalize_code(r[c_code_v]), 
                                    safe_int(r.get(c_zona_v, 0)), 
                                    safe_int(r.get(c_secao_v, 0)), 
                                    safe_int(r.get(c_local_v, 0)), 
                                    r[c_cand_v], 
                                    safe_int(r.get(c_qt_v, 0))
                                ))
                            execute_values(cur, "INSERT INTO tse_votos_secao (ano_eleicao, cd_municipio, nr_zona, nr_secao, nr_local_votacao, nr_candidato, qt_votos) VALUES %s", votos_data)

        # 4. Perfil Eleitorado
        report_progress(tenant_id, "Analisando Perfil Eleitoral...", 85)
        for f in os.listdir(tmp_dir): os.remove(os.path.join(tmp_dir, f))
        
        url_perfil = f"https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_{ano}.zip"
        if download_and_extract(url_perfil, tmp_dir):
            for file in os.listdir(tmp_dir):
                if file.lower().endswith('.csv') and 'perfil_eleitorado' in file.lower():
                    chunks_perf = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=100000, dtype=str)
                    for chunk in chunks_perf:
                        chunk.columns = [c.upper() for c in chunk.columns]
                        c_city_p = find_column(chunk.columns, ['NM', 'MUN']) or find_column(chunk.columns, ['NM', 'UE'])
                        c_code_p = find_column(chunk.columns, ['CD', 'MUN']) or find_column(chunk.columns, ['CD', 'UE'])
                        c_bairro_p = find_column(chunk.columns, ['NM', 'BAIRRO']) or find_column(chunk.columns, ['NM', 'LOCALIDADE'])
                        c_gen = find_column(chunk.columns, ['DS', 'GENERO'])
                        c_idade = find_column(chunk.columns, ['DS', 'FAIXA', 'ETARIA'])
                        c_esc = find_column(chunk.columns, ['DS', 'GRAU', 'ESCOLARIDADE'])
                        c_qt_p = find_column(chunk.columns, ['QT', 'ELEITORES', 'PERFIL']) or find_column(chunk.columns, ['QT', 'ELEITORES'])
                        
                        if not c_city_p: continue

                        chunk['CITY_NORM'] = chunk[c_city_p].apply(normalize_text)
                        perfil_city = chunk[chunk['CITY_NORM'] == municipio_norm]
                        if not perfil_city.empty:
                            perf_data = []
                            for _, r in perfil_city.iterrows():
                                perf_data.append((
                                    ano, 
                                    normalize_code(r[c_code_p]), 
                                    r.get(c_bairro_p, 'NÃO INFORMADO'), 
                                    r.get(c_gen, 'NÃO INFORMADO'), 
                                    r.get(c_idade, 'NÃO INFORMADO'), 
                                    r.get(c_esc, 'NÃO INFORMADO'), 
                                    safe_int(r.get(c_qt_p, 0))
                                ))
                            execute_values(cur, """
                                INSERT INTO tse_perfil_eleitorado (ano_eleicao, cd_municipio, nm_bairro, ds_genero, ds_faixa_etaria, ds_grau_escolaridade, qt_eleitores) 
                                VALUES %s
                            """, perf_data)

        conn.commit()
        report_progress(tenant_id, "Concluído!", 100)
    except Exception as e:
        if conn: conn.rollback()
        print(f"ERRO: {e}")
        import traceback
        traceback.print_exc()
        report_progress(tenant_id, f"Falha nos dados: {str(e)}", 0)
    finally:
        if conn: conn.close()
        if os.path.exists(tmp_dir): shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Uso: python tse_import.py <ano> <uf> <municipio> <nr_candidato> <tenant_id>")
        sys.exit(1)
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
