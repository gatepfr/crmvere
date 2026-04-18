import csv
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

def download_file(url, target_file):
    print(f"Baixando: {url}")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        with requests.get(url, headers=headers, stream=True, timeout=600) as r:
            if r.status_code != 200: return False
            with open(target_file, 'wb') as f:
                shutil.copyfileobj(r.raw, f)
        return True
    except: return False

def process_import(ano, uf, municipio_nome, nr_candidato, tenant_id):
    print(f"--- IMPORTAÇÃO LEVE TSE V19 (ESTADO: {uf}) ---")
    work_dir = f"/app/tse_data_{tenant_id}"
    os.makedirs(work_dir, exist_ok=True)
    
    municipio_norm = normalize_text(municipio_nome)
    nr_cand_norm = normalize_code(nr_candidato)
    
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        report_progress(tenant_id, "Iniciando Inteligência...", 5)

        # 1. BUSCA CANDIDATO
        report_progress(tenant_id, "Buscando Candidato...", 10)
        url_cand = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip"
        zip_path = os.path.join(work_dir, "cand.zip")
        
        if download_file(url_cand, zip_path):
            with zipfile.ZipFile(zip_path) as z:
                for filename in z.namelist():
                    if filename.upper().endswith('.CSV'):
                        with z.open(filename) as f:
                            # Lê linha por linha (Modo Leve)
                            reader = csv.DictReader(io.TextIOWrapper(f, encoding='latin1'), delimiter=';')
                            for row in reader:
                                row = {k.upper(): v for k, v in row.items()}
                                city = normalize_text(row.get('NM_UE') or row.get('NM_MUNICIPIO', ''))
                                num = normalize_code(row.get('NR_CANDIDATO', ''))
                                
                                if city == municipio_norm and num == nr_cand_norm:
                                    cd_mun = normalize_code(row.get('SG_UE') or row.get('CD_MUNICIPIO', ''))
                                    name = row.get('NM_URNA_CANDIDATO') or row.get('NM_CANDIDATO', 'CANDIDATO')
                                    partido = row.get('SG_PARTIDO', '---')
                                    situacao = row.get('DS_SITUACAO_TOT_TURNO') or row.get('DS_SITUACAO_TOT', '---')
                                    
                                    cur.execute("DELETE FROM tse_candidatos WHERE tenant_id = %s AND ano_eleicao = %s", (tenant_id, int(ano)))
                                    cur.execute("INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)", 
                                               (tenant_id, int(ano), name, num, partido, cd_mun, row.get('NM_UE'), situacao))
                                    conn.commit()
                                    
                                    # INÍCIO DO PROCESSAMENTO DETALHADO
                                    process_details(cur, conn, tenant_id, int(ano), uf, cd_mun, nr_cand_norm, work_dir)
                                    report_progress(tenant_id, "Inteligência Gerada com Sucesso!", 100)
                                    return

        raise Exception(f"Candidato {nr_candidato} não encontrado em {municipio_nome}. Verifique os dados.")

    except Exception as e:
        if conn: conn.rollback()
        traceback.print_exc()
        report_progress(tenant_id, f"Erro: {str(e)}", 0)
    finally:
        if conn: conn.close()
        if os.path.exists(work_dir): shutil.rmtree(work_dir)

def process_details(cur, conn, tenant_id, ano, uf, cd_mun, nr_candidato, work_dir):
    # 2. LOCAIS DE VOTAÇÃO
    report_progress(tenant_id, "Mapeando Redutos (Bairros)...", 30)
    url_locais = f"https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_{ano}.zip"
    zip_loc = os.path.join(work_dir, "locais.zip")
    if download_file(url_locais, zip_loc):
        cur.execute("DELETE FROM tse_locais_votacao WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_mun, ano))
        with zipfile.ZipFile(zip_loc) as z:
            for filename in z.namelist():
                if filename.upper().endswith('.CSV'):
                    with z.open(filename) as f:
                        reader = csv.DictReader(io.TextIOWrapper(f, encoding='latin1'), delimiter=';')
                        l_data = []
                        for row in reader:
                            row = {k.upper(): v for k, v in row.items()}
                            if normalize_code(row.get('CD_MUNICIPIO') or row.get('SG_UE')) == cd_mun:
                                l_data.append((ano, cd_mun, int(row.get('NR_ZONA', 0)), int(row.get('NR_LOCAL_VOTACAO', 0)), row.get('NM_LOCAL_VOTACAO'), row.get('DS_ENDERECO'), row.get('NM_BAIRRO', 'CENTRO')))
                                if len(l_data) >= 500:
                                    execute_values(cur, "INSERT INTO tse_locais_votacao (ano_eleicao, cd_municipio, nr_zona, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro) VALUES %s", l_data)
                                    l_data = []
                        if l_data: execute_values(cur, "INSERT INTO tse_locais_votacao (ano_eleicao, cd_municipio, nr_zona, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro) VALUES %s", l_data)
        conn.commit()

    # 3. VOTOS POR SEÇÃO
    report_progress(tenant_id, "Contando Votos Oficiais...", 60)
    url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
    zip_votos = os.path.join(work_dir, "votos.zip")
    if download_file(url_votos, zip_votos):
        cur.execute("DELETE FROM tse_votos_secao WHERE cd_municipio = %s AND nr_candidato = %s AND ano_eleicao = %s", (cd_mun, nr_candidato, ano))
        with zipfile.ZipFile(zip_votos) as z:
            for filename in z.namelist():
                if filename.upper().endswith('.CSV'):
                    with z.open(filename) as f:
                        reader = csv.DictReader(io.TextIOWrapper(f, encoding='latin1'), delimiter=';')
                        v_data = []
                        for row in reader:
                            row = {k.upper(): v for k, v in row.items()}
                            c_mun = normalize_code(row.get('CD_MUNICIPIO') or row.get('SG_UE'))
                            c_num = normalize_code(row.get('NR_VOTAVEL') or row.get('NR_CANDIDATO'))
                            if c_mun == cd_mun and c_num == nr_candidato:
                                v_data.append((ano, cd_mun, int(row.get('NR_ZONA', 0)), int(row.get('NR_SECAO', 0)), int(row.get('NR_LOCAL_VOTACAO', 0)), nr_candidato, int(row.get('QT_VOTOS', 0))))
                                if len(v_data) >= 1000:
                                    execute_values(cur, "INSERT INTO tse_votos_secao (ano_eleicao, cd_municipio, nr_zona, nr_secao, nr_local_votacao, nr_candidato, qt_votos) VALUES %s", v_data)
                                    v_data = []
                        if v_data: execute_values(cur, "INSERT INTO tse_votos_secao (ano_eleicao, cd_municipio, nr_zona, nr_secao, nr_local_votacao, nr_candidato, qt_votos) VALUES %s", v_data)
        conn.commit()

    # 4. PERFIL DEMOGRÁFICO
    report_progress(tenant_id, "Analisando Perfil Demográfico...", 85)
    url_perf = f"https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/perfil_eleitorado_{ano}.zip"
    zip_perf = os.path.join(work_dir, "perfil.zip")
    if download_file(url_perf, zip_perf):
        cur.execute("DELETE FROM tse_perfil_eleitorado WHERE cd_municipio = %s AND ano_eleicao = %s", (cd_mun, ano))
        with zipfile.ZipFile(zip_perf) as z:
            for filename in z.namelist():
                if filename.upper().endswith('.CSV'):
                    with z.open(filename) as f:
                        reader = csv.DictReader(io.TextIOWrapper(f, encoding='latin1'), delimiter=';')
                        p_data = []
                        for row in reader:
                            row = {k.upper(): v for k, v in row.items()}
                            if normalize_code(row.get('CD_MUNICIPIO') or row.get('CD_MUN_ESTATISTICO')) == cd_mun:
                                qt = int(row.get('QT_ELEITORES_PERFIL') or row.get('QT_ELEITORES', 0))
                                p_data.append((ano, cd_mun, row.get('NM_BAIRRO', 'CENTRO'), row.get('DS_GENERO', 'NÃO INFORMADO'), row.get('DS_FAIXA_ETARIA', 'NÃO INFORMADO'), row.get('DS_GRAU_ESCOLARIDADE', 'NÃO INFORMADO'), qt))
                                if len(p_data) >= 1000:
                                    execute_values(cur, "INSERT INTO tse_perfil_eleitorado (ano_eleicao, cd_municipio, nm_bairro, ds_genero, ds_faixa_etaria, ds_grau_escolaridade, qt_eleitores) VALUES %s", p_data)
                                    p_data = []
                        if p_data: execute_values(cur, "INSERT INTO tse_perfil_eleitorado (ano_eleicao, cd_municipio, nm_bairro, ds_genero, ds_faixa_etaria, ds_grau_escolaridade, qt_eleitores) VALUES %s", p_data)
        conn.commit()

if __name__ == "__main__":
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
