import { Router } from 'express';
import { spawn } from 'child_process';
import { db } from '../db';
import { tseCandidatos } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import Redis from 'ioredis';

const router = Router();
router.use(authenticate);

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * Inicia o processo de importação
 */
router.post('/importar', async (req, res) => {
  const { ano, uf, municipio, nrCandidato } = req.body;
  const tenantId = req.user?.tenantId;

  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  console.log(`[ELEICOES] Disparando importação: ${ano} ${uf} ${municipio} - Candidato ${nrCandidato} usando ${pythonCmd}`);

  const pythonProcess = spawn(pythonCmd, [
    'src/scripts/tse_import.py',
    ano.toString(),
    uf.toUpperCase(),
    municipio.toUpperCase(),
    nrCandidato.toString(),
    tenantId
  ], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  pythonProcess.on('error', (err) => {
    console.error(`[ELEICOES] Falha ao iniciar processo Python (${pythonCmd}):`, err);
    redisClient.set(`tse:import:${tenantId}:step`, `Erro: Falha ao iniciar Python (${err.message})`);
    redisClient.set(`tse:import:${tenantId}:progress`, 0);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[ELEICOES] Processo Python finalizado com código ${code}`);
    if (code !== 0) {
      redisClient.set(`tse:import:${tenantId}:step`, `Erro: O processamento falhou (Código ${code})`);
      redisClient.set(`tse:import:${tenantId}:progress`, 0);
    }
  });

  pythonProcess.stdout.on('data', (data) => console.log(`[PYTHON STDOUT] ${data.toString()}`));
  pythonProcess.stderr.on('data', (data) => console.error(`[PYTHON STDERR] ${data.toString()}`));

  res.json({ status: 'started' });
});

/**
 * Consulta progresso
 */
router.get('/status', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  const progress = await redisClient.get(`tse:import:${tenantId}:progress`);
  const step = await redisClient.get(`tse:import:${tenantId}:step`);

  res.json({
    percent: progress ? parseInt(progress) : 0,
    step: step || 'Aguardando...'
  });
});

/**
 * Retorna os dados para o Dashboard
 */
router.get('/resumo', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  try {
    const [candidato] = await db.select().from(tseCandidatos).where(eq(tseCandidatos.tenantId, tenantId)).limit(1);
    
    // Se não houver candidato, força o frontend a mostrar o formulário
    if (!candidato) {
      return res.json({ setup_required: true });
    }

    const cdMun = candidato.cdMunicipio;

    // 1. Votos por Bairro (Consulta sem duplicação)
    const stats = await db.execute(sql`
      WITH total_votos_local AS (
        SELECT nr_zona, nr_local_votacao, SUM(qt_votos) as votos
        FROM tse_votos_secao
        WHERE nr_candidato = ${candidato.nrCandidato}
          AND cd_municipio = ${cdMun}
          AND ano_eleicao = ${candidato.anoEleicao}
        GROUP BY 1, 2
      ),
      bairros_mapeados AS (
        SELECT DISTINCT ON (nr_zona, nr_local_votacao)
          nr_zona, nr_local_votacao, UPPER(nm_bairro) as bairro
        FROM tse_locais_votacao
        WHERE cd_municipio = ${cdMun}
          AND ano_eleicao = ${candidato.anoEleicao}
      )
      SELECT 
          COALESCE(NULLIF(b.bairro, ''), 'CENTRO') as nm_bairro,
          SUM(v.votos)::int as total_votos
      FROM total_votos_local v
      LEFT JOIN bairros_mapeados b ON v.nr_local_votacao = b.nr_local_votacao 
        AND v.nr_zona = b.nr_zona
      GROUP BY 1
      ORDER BY total_votos DESC
    `);

    // 2. Total Geral (Fonte da Verdade)
    const totalVotosResult = await db.execute(sql`
      SELECT SUM(qt_votos) as total 
      FROM tse_votos_secao 
      WHERE nr_candidato = ${candidato.nrCandidato}
        AND cd_municipio = ${cdMun}
        AND ano_eleicao = ${candidato.anoEleicao}
    `);

    const totalVotos = Number(totalVotosResult.rows[0]?.total || 0);

    // 3. Mapa de Calor (Agrupado por Bairro se Coordenadas das Escolas falharem)
    const mapaCalor = await db.execute(sql`
      WITH votos_bairro AS (
        SELECT 
          UPPER(COALESCE(NULLIF(l.nm_bairro, ''), 'CENTRO')) as bairro,
          SUM(v.qt_votos) as votos
        FROM tse_votos_secao v
        JOIN tse_locais_votacao l ON v.nr_local_votacao = l.nr_local_votacao 
          AND v.nr_zona = l.nr_zona AND v.cd_municipio = l.cd_municipio
        WHERE v.nr_candidato = ${candidato.nrCandidato}
          AND v.cd_municipio = ${cdMun}
          AND v.ano_eleicao = ${candidato.anoEleicao}
        GROUP BY 1
      ),
      coords_bairro AS (
        -- Busca a primeira coordenada válida encontrada em cada bairro para servir de centro
        SELECT DISTINCT ON (UPPER(nm_bairro))
          UPPER(nm_bairro) as bairro,
          latitude,
          longitude
        FROM tse_locais_votacao
        WHERE cd_municipio = ${cdMun} AND latitude IS NOT NULL
      )
      SELECT 
          v.bairro as nm_local_votacao, -- Reutiliza campo para o frontend
          COALESCE(c.latitude, '0') as latitude,
          COALESCE(c.longitude, '0') as longitude,
          v.votos::int as total_votos
      FROM votos_bairro v
      LEFT JOIN coords_bairro c ON v.bairro = c.bairro
      WHERE v.votos > 0
    `);

    // 4. Perfil Demográfico do Eleitorado do Município
    // Mapeia códigos numéricos do TSE para labels legíveis (dados antigos usam CD_ em vez de DS_)
    const perfilGenero = await db.execute(sql`
      SELECT CASE ds_genero
        WHEN '2' THEN 'Feminino' WHEN '4' THEN 'Masculino'
        WHEN 'FEMININO' THEN 'Feminino' WHEN 'MASCULINO' THEN 'Masculino'
        ELSE ds_genero END as label,
        SUM(qt_eleitores)::int as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
        AND ds_genero IS NOT NULL AND ds_genero NOT IN ('-1', '-3')
      GROUP BY 1 ORDER BY value DESC
    `);

    const perfilIdade = await db.execute(sql`
      SELECT CASE
        WHEN ds_faixa_etaria IN ('1600','1700') THEN '16-17'
        WHEN ds_faixa_etaria IN ('1800','1900','2000') THEN '18-20'
        WHEN ds_faixa_etaria = '2124' THEN '21-24'
        WHEN ds_faixa_etaria = '2529' THEN '25-29'
        WHEN ds_faixa_etaria = '3034' THEN '30-34'
        WHEN ds_faixa_etaria = '3539' THEN '35-39'
        WHEN ds_faixa_etaria = '4044' THEN '40-44'
        WHEN ds_faixa_etaria = '4549' THEN '45-49'
        WHEN ds_faixa_etaria = '5054' THEN '50-54'
        WHEN ds_faixa_etaria = '5559' THEN '55-59'
        WHEN ds_faixa_etaria = '6064' THEN '60-64'
        WHEN ds_faixa_etaria = '6569' THEN '65-69'
        WHEN ds_faixa_etaria = '7074' THEN '70-74'
        WHEN ds_faixa_etaria = '7579' THEN '75-79'
        WHEN ds_faixa_etaria IN ('8084','8589','9094','9599','100') THEN '80+'
        ELSE ds_faixa_etaria END as label,
        SUM(qt_eleitores)::int as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
        AND ds_faixa_etaria IS NOT NULL AND ds_faixa_etaria NOT IN ('-1', '-3')
      GROUP BY 1 ORDER BY label ASC
    `);

    const perfilEscolaridade = await db.execute(sql`
      SELECT CASE ds_grau_escolaridade
        WHEN '1' THEN 'Analfabeto'
        WHEN '2' THEN 'Lê e Escreve'
        WHEN '3' THEN 'Fund. Incompl.'
        WHEN '4' THEN 'Fund. Compl.'
        WHEN '5' THEN 'Médio Incompl.'
        WHEN '6' THEN 'Médio Compl.'
        WHEN '7' THEN 'Sup. Incompl.'
        WHEN '8' THEN 'Sup. Compl.'
        ELSE ds_grau_escolaridade END as label,
        SUM(qt_eleitores)::int as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
        AND ds_grau_escolaridade IS NOT NULL AND ds_grau_escolaridade NOT IN ('-1', '-3')
      GROUP BY 1 ORDER BY value DESC
    `);

    res.json({
      candidato: {
          ...candidato,
          qtVotosTotal: totalVotos
      },
      bairros: stats.rows || [],
      mapa: mapaCalor.rows || [],
      perfil: {
        genero: perfilGenero.rows || [],
        idade: perfilIdade.rows || [],
        escolaridade: perfilEscolaridade.rows || []
      }
    });
  } catch (error: any) {
    console.error('[ELEICOES ERROR]', error.message);
    // Em caso de erro, ainda tenta mostrar o formulário como fallback
    res.json({ setup_required: true, error: error.message });
  }
});

export default router;
