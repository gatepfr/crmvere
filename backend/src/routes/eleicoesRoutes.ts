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

    // Consulta robusta: Tenta somar votos filtrando por município e ano do candidato
    const stats = await db.execute(sql`
      SELECT 
          COALESCE(NULLIF(l.nm_bairro, ''), 'NÃO MAPEADO') as nm_bairro,
          SUM(v.qt_votos) as total_votos
      FROM tse_votos_secao v
      LEFT JOIN tse_locais_votacao l ON v.nr_local_votacao = l.nr_local_votacao 
        AND v.nr_zona = l.nr_zona
        AND v.cd_municipio = l.cd_municipio 
        AND v.ano_eleicao = l.ano_eleicao
      WHERE v.nr_candidato = ${candidato.nrCandidato}
        AND v.cd_municipio = ${candidato.cdMunicipio}
        AND v.ano_eleicao = ${candidato.anoEleicao}
      GROUP BY 1
      ORDER BY total_votos DESC
      LIMIT 100
    `);

    // Busca o total real de votos direto na tabela de votos (sem joins) para o card de resumo
    const totalVotosResult = await db.execute(sql`
      SELECT SUM(qt_votos) as total 
      FROM tse_votos_secao 
      WHERE nr_candidato = ${candidato.nrCandidato}
        AND cd_municipio = ${candidato.cdMunicipio}
        AND ano_eleicao = ${candidato.anoEleicao}
    `);

    const totalVotos = Number(totalVotosResult.rows[0]?.total || 0);

    // Se achou o candidato mas não achou votos, pode ser erro de importação
    if (totalVotos == 0 && candidato) {
        console.warn(`[ELEICOES] Candidato ${candidato.nmCandidato} sem votos no banco.`);
    }

    // Busca os pontos do mapa de calor (votos por local com coordenadas)
    const mapaCalor = await db.execute(sql`
      SELECT 
          l.nm_local_votacao,
          l.latitude,
          l.longitude,
          SUM(v.qt_votos) as total_votos
      FROM tse_votos_secao v
      JOIN tse_locais_votacao l ON v.nr_local_votacao = l.nr_local_votacao 
        AND v.nr_zona = l.nr_zona
        AND v.cd_municipio = l.cd_municipio 
        AND v.ano_eleicao = l.ano_eleicao
      WHERE v.nr_candidato = ${candidato.nrCandidato}
        AND v.cd_municipio = ${candidato.cdMunicipio}
        AND v.ano_eleicao = ${candidato.anoEleicao}
        AND l.latitude IS NOT NULL
      GROUP BY 1, 2, 3
    `);

    // Busca Perfil: Gênero
    const perfilGenero = await db.execute(sql`
      SELECT ds_genero as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${candidato.cdMunicipio} AND ano_eleicao = ${candidato.anoEleicao}
      GROUP BY 1 ORDER BY value DESC
    `);

    // Busca Perfil: Faixa Etária
    const perfilIdade = await db.execute(sql`
      SELECT ds_faixa_etaria as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${candidato.cdMunicipio} AND ano_eleicao = ${candidato.anoEleicao}
      GROUP BY 1 ORDER BY label ASC
    `);

    // Busca Perfil: Escolaridade
    const perfilEscolaridade = await db.execute(sql`
      SELECT ds_grau_escolaridade as label, SUM(qt_eleitores) as value
      FROM tse_perfil_eleitorado
      WHERE cd_municipio = ${candidato.cdMunicipio} AND ano_eleicao = ${candidato.anoEleicao}
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
