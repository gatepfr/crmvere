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
from datetime import datetime

# Configurações de ambiente
DATABASE_URL = os.getenv('DATABASE_URL')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

def report_progress(tenant_id, step, percent):
    try:
        r = redis.from_url(REDIS_URL)
        r.set(f"tse:import:{tenant_id}:progress", percent)
        r.set(f"tse:import:{tenant_id}:step", step)
        print(f"[{percent}%] {step}")
    except Exception as e:
        print(f"Erro ao reportar progresso no Redis: {e}")

def download_and_extract(url, target_path):
    print(f"Baixando {url}...")
    response = requests.get(url)
    if response.status_code == 200:
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            z.extractall(target_path)
        return True
    return False

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def process_import(ano, uf, municipio_nome, nr_candidato, tenant_id):
    tmp_dir = f"/tmp/tse_import_{tenant_id}_{datetime.now().timestamp()}"
    os.makedirs(tmp_dir, exist_ok=True)
    
    conn = None
    try:
        report_progress(tenant_id, "Iniciando importação de dados...", 5)
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Candidatos
        report_progress(tenant_id, "Buscando dados do candidato...", 15)
        url_cand = f"https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}_{uf}.zip"
        if download_and_extract(url_cand, tmp_dir):
            # Procura o CSV de candidatos
            for file in os.listdir(tmp_dir):
                if file.endswith('.csv') and 'consulta_cand' in file:
                    df = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1')
                    cand = df[(df['NM_UE'] == municipio_nome.upper()) & (df['NR_CANDIDATO'] == int(nr_candidato))]
                    
                    if not cand.empty:
                        c = cand.iloc[0]
                        cur.execute("""
                            INSERT INTO tse_candidatos (tenant_id, ano_eleicao, nm_candidato, nr_candidato, sg_partido, cd_municipio, nm_municipio, ds_situacao)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT DO NOTHING
                        """, (tenant_id, ano, c['NM_CANDIDATO'], str(c['NR_CANDIDATO']), c['SG_PARTIDO'], str(c['CD_MUNICIPIO']), c['NM_UE'], c['DS_SITUACAO_CANDIDATURA']))
        
        # 2. Locais de Votação
        report_progress(tenant_id, "Mapeando locais de votação...", 40)
        # O TSE disponibiliza locais em diferentes arquivos dependendo do ano
        # Simplificação para v1.0
        
        # 3. Votos por Seção
        report_progress(tenant_id, "Processando votos por seção (isso pode demorar)...", 60)
        url_votos = f"https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_{ano}_{uf}.zip"
        if download_and_extract(url_votos, tmp_dir):
             for file in os.listdir(tmp_dir):
                if file.endswith('.csv') and 'votacao_secao' in file:
                    # Uso de chunks para não estourar memória
                    chunks = pd.read_csv(os.path.join(tmp_dir, file), sep=';', encoding='latin1', chunksize=50000)
                    for chunk in chunks:
                        filtered = chunk[(chunk['NM_MUNICIPIO'] == municipio_nome.upper()) & (chunk['NR_VOTAVEL'] == int(nr_candidato))]
                        if not filtered.empty:
                            data = [
                                (ano, str(r['CD_MUNICIPIO']), r['NR_ZONA'], r['NR_SECAO'], r['NR_LOCAL_VOTACAO'], str(r['NR_VOTAVEL']), r['QT_VOTOS'])
                                for _, r in filtered.iterrows()
                            ]
                            execute_values(cur, """
                                INSERT INTO tse_votos_secao (ano_eleicao, cd_municipio, nr_zona, nr_secao, nr_local_votacao, nr_candidato, qt_votos)
                                VALUES %s
                            """, data)
        
        conn.commit()
        report_progress(tenant_id, "Limpeza e finalização...", 95)

    except Exception as e:
        print(f"ERRO FATAL: {e}")
        if conn: conn.rollback()
        report_progress(tenant_id, f"Erro: {str(e)}", 0)
    finally:
        if conn: conn.close()
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)
        report_progress(tenant_id, "Importação concluída com sucesso!", 100)

if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Uso: python tse_import.py <ano> <uf> <municipio> <nr_candidato> <tenant_id>")
        sys.exit(1)
    
    # Ex: python tse_import.py 2024 PR APUCARANA 55123 uuid-tenant
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
