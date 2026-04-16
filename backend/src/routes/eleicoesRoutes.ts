import { Router } from 'express';
import { spawn } from 'child_process';
import { db } from '../db';
import { tseCandidatos, tseLocaisVotacao, tseVotosSecao } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import redis from 'redis';

const router = Router();
router.use(authenticate);

const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

/**
 * Inicia o processo de importação do TSE via script Python
 */
router.post('/importar', async (req, res) => {
  const { ano, uf, municipio, nrCandidato } = req.body;
  const tenantId = req.user?.tenantId;

  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });
  if (!ano || !uf || !municipio || !nrCandidato) {
    return res.status(400).json({ error: 'Parâmetros incompletos (ano, uf, municipio, nrCandidato)' });
  }

  console.log(`[ELEICOES] Disparando importação: ${ano} ${uf} ${municipio} - Candidato ${nrCandidato}`);

  // Dispara o script Python em background
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

  pythonProcess.stdout.on('data', (data) => console.log(`[PYTHON STDOUT] ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`[PYTHON STDERR] ${data}`));

  res.json({ status: 'started', message: 'Importação iniciada em segundo plano.' });
});

/**
 * Consulta o progresso da importação no Redis
 */
router.get('/status', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  try {
    const progress = await redisClient.get(`tse:import:${tenantId}:progress`);
    const step = await redisClient.get(`tse:import:${tenantId}:step`);

    res.json({
      percent: progress ? parseInt(progress) : 0,
      step: step || 'Aguardando...'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar status do Redis' });
  }
});

/**
 * Retorna os dados resumidos para o Dashboard
 */
router.get('/resumo', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant required' });

  try {
    // Busca dados do candidato vinculado
    const [candidato] = await db.select().from(tseCandidatos).where(eq(tseCandidatos.tenantId, tenantId)).limit(1);
    
    if (!candidato) return res.json({ setup_required: true });

    // Consulta na View Materializada (Simulada via SQL bruto para v1.0)
    const stats = await db.execute(sql`
      SELECT 
        nm_bairro, 
        total_votos 
      FROM (
        SELECT 
            l.nm_bairro,
            SUM(v.qt_votos) as total_votos
        FROM tse_votos_secao v
        JOIN tse_locais_votacao l ON v.nr_local_votacao = l.nr_local_votacao AND v.cd_municipio = l.cd_municipio
        WHERE v.nr_candidato = ${candidato.nrCandidato}
        GROUP BY l.nm_bairro
      ) as sub
      ORDER BY total_votos DESC
    `);

    res.json({
      candidato,
      bairros: stats.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
