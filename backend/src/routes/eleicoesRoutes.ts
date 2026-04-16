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

  // Dispara o script Python
  spawn('python3', [
    'src/scripts/tse_import.py',
    ano.toString(),
    uf.toUpperCase(),
    municipio.toUpperCase(),
    nrCandidato.toString(),
    tenantId
  ], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    detached: true,
    stdio: 'ignore'
  }).unref();

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
 * Retorna os dados para o Dashboard (Versão Robusta)
 */
router.get('/resumo', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  try {
    const [candidato] = await db.select().from(tseCandidatos).where(eq(tseCandidatos.tenantId, tenantId)).limit(1);
    if (!candidato) return res.json({ setup_required: true });

    // Consulta direta nas tabelas em vez de depender da View (mais seguro para v1.0)
    const stats = await db.execute(sql`
      SELECT 
          l.nm_bairro,
          SUM(v.qt_votos) as total_votos
      FROM tse_votos_secao v
      JOIN tse_locais_votacao l ON v.nr_local_votacao = l.nr_local_votacao 
        AND v.cd_municipio = l.cd_municipio 
        AND v.ano_eleicao = l.ano_eleicao
      WHERE v.nr_candidato = ${candidato.nrCandidato}
      GROUP BY l.nm_bairro
      ORDER BY total_votos DESC
      LIMIT 50
    `);

    res.json({
      candidato,
      bairros: stats.rows || []
    });
  } catch (error: any) {
    console.error('[ELEICOES ERROR]', error.message);
    // Retorna vazio em vez de erro 500 para evitar logout
    res.json({ candidato: null, bairros: [], error: 'Dados ainda não processados.' });
  }
});

export default router;
