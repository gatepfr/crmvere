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

    // 3. Mapa de Calor
    const mapaCalor = await db.execute(sql`
      WITH votos_local AS (
        SELECT nr_zona, nr_local_votacao, SUM(qt_votos) as votos
        FROM tse_votos_secao
        WHERE nr_candidato = ${candidato.nrCandidato}
          AND cd_municipio = ${cdMun}
          AND ano_eleicao = ${candidato.anoEleicao}
        GROUP BY 1, 2
      ),
      coords_unicas AS (
        SELECT DISTINCT ON (nr_zona, nr_local_votacao)
          nr_zona, nr_local_votacao, nm_local_votacao, latitude, longitude
        FROM tse_locais_votacao
        WHERE cd_municipio = ${cdMun}
          AND ano_eleicao = ${candidato.anoEleicao}
          AND latitude IS NOT NULL
      )
      SELECT 
          c.nm_local_votacao,
          c.latitude,
          c.longitude,
          v.votos::int as total_votos
      FROM votos_local v
      JOIN coords_unicas c ON v.nr_local_votacao = c.nr_local_votacao 
        AND v.nr_zona = c.nr_zona
    `);

    // 4. Perfil Eleitorado
    const perfilGenero = await db.execute(sql`
      SELECT UPPER(ds_genero) as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
      GROUP BY 1 ORDER BY value DESC
    `);

    const perfilIdade = await db.execute(sql`
      SELECT ds_faixa_etaria as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
      GROUP BY 1 ORDER BY label ASC
    `);

    const perfilEscolaridade = await db.execute(sql`
      SELECT ds_grau_escolaridade as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
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
