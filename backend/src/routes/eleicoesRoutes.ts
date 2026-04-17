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

  console.log(`[ELEICOES] Disparando importação: ${ano} ${uf} ${municipio} - Candidato ${nrCandidato}`);

  // Dispara o script Python permitindo que o log apareça no stdout/stderr do Docker
  const pythonProcess = spawn('python3', [
    'src/scripts/tse_import.py',
    ano.toString(),
    uf.toUpperCase(),
    municipio.toUpperCase(),
    nrCandidato.toString(),
    tenantId
  ], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
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
 * Retorna os dados para o Dashboard (Versão de Alta Tolerância)
 */
router.get('/resumo', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  try {
    const [candidato] = await db.select().from(tseCandidatos).where(eq(tseCandidatos.tenantId, tenantId)).limit(1);
    if (!candidato) return res.json({ setup_required: true });

    const cdMun = parseInt(candidato.cdMunicipio || '0');

    // 1. Busca votos agrupados por seção PRIMEIRO (Garante soma exata do TSE)
    // 2. Depois mapeia para bairros usando subquery de locais únicos
    const stats = await db.execute(sql`
      WITH votos_base AS (
        SELECT nr_zona, nr_local_votacao, SUM(qt_votos) as total_votos
        FROM tse_votos_secao
        WHERE nr_candidato = ${candidato.nrCandidato}
          AND cd_municipio::int = ${cdMun}
          AND ano_eleicao = ${candidato.anoEleicao}
        GROUP BY 1, 2
      ),
      locais_unicos AS (
        SELECT DISTINCT ON (nr_zona, nr_local_votacao, cd_municipio, ano_eleicao)
          nr_zona, nr_local_votacao, cd_municipio, ano_eleicao, nm_bairro
        FROM tse_locais_votacao
        WHERE cd_municipio::int = ${cdMun}
          AND ano_eleicao = ${candidato.anoEleicao}
      )
      SELECT 
          COALESCE(NULLIF(l.nm_bairro, ''), 'NÃO MAPEADO') as nm_bairro,
          SUM(v.total_votos)::int as total_votos
      FROM votos_base v
      LEFT JOIN locais_unicos l ON v.nr_local_votacao = l.nr_local_votacao 
        AND v.nr_zona = l.nr_zona
      GROUP BY 1
      ORDER BY total_votos DESC
    `);

    // Busca o total real de votos direto na tabela de votos (Sem Joins = Zero erro)
    const totalVotosResult = await db.execute(sql`
      SELECT SUM(qt_votos) as total 
      FROM tse_votos_secao 
      WHERE nr_candidato = ${candidato.nrCandidato}
        AND cd_municipio::int = ${cdMun}
        AND ano_eleicao = ${candidato.anoEleicao}
    `);

    const totalVotos = Number(totalVotosResult.rows[0]?.total || 0);

    // Mapa de Calor (Com coordenadas únicas)
    const mapaCalor = await db.execute(sql`
      WITH votos_local AS (
        SELECT nr_zona, nr_local_votacao, SUM(qt_votos) as votos
        FROM tse_votos_secao
        WHERE nr_candidato = ${candidato.nrCandidato}
          AND cd_municipio::int = ${cdMun}
          AND ano_eleicao = ${candidato.anoEleicao}
        GROUP BY 1, 2
      ),
      coords_unicas AS (
        SELECT DISTINCT ON (nr_zona, nr_local_votacao)
          nr_zona, nr_local_votacao, nm_local_votacao, latitude, longitude
        FROM tse_locais_votacao
        WHERE cd_municipio::int = ${cdMun}
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

    // Busca Perfil: Gênero
    const perfilGenero = await db.execute(sql`
      SELECT UPPER(ds_genero) as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio::int = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
      GROUP BY 1 ORDER BY value DESC
    `);

    // Busca Perfil: Faixa Etária
    const perfilIdade = await db.execute(sql`
      SELECT ds_faixa_etaria as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio::int = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
      GROUP BY 1 ORDER BY label ASC
    `);

    // Busca Perfil: Escolaridade
    const perfilEscolaridade = await db.execute(sql`
      SELECT ds_grau_escolaridade as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio::int = ${cdMun} AND ano_eleicao = ${candidato.anoEleicao}
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
    res.json({ candidato: null, bairros: [], error: 'Erro ao processar dados.' });
  }
});

export default router;
