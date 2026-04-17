import { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes, tenants, atendimentos, tseCandidatos } from '../db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

export const getDashboardStats = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const [tenant] = await db.select({
      dailyTokenLimit: tenants.dailyTokenLimit,
      tokenUsageTotal: tenants.tokenUsageTotal
    }).from(tenants).where(eq(tenants.id, tenantId));

    const [summary] = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${demandas.status} = 'nova')::int`
    }).from(demandas).where(eq(demandas.tenantId, tenantId));

    const [atendimentoSummary] = await db.select({
      needsAttention: sql<number>`count(*) filter (where ${atendimentos.precisaRetorno} = true)::int`
    }).from(atendimentos).where(eq(atendimentos.tenantId, tenantId));

    const [municipeSummary] = await db.select({
      total: sql<number>`count(*)::int`,
      birthdaysToday: sql<number>`count(*) filter (where to_char(${municipes.birthDate}, 'DD-MM') = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD-MM'))::int`,
      uniqueBairros: sql<number>`count(distinct ${municipes.bairro})::int`
    }).from(municipes).where(eq(municipes.tenantId, tenantId));

    const categoryStats = await db.select({
      name: demandas.categoria,
      value: sql<number>`count(*)::int`
    }).from(demandas).where(eq(demandas.tenantId, tenantId)).groupBy(demandas.categoria);

    const last7Days = await db.select({
      date: sql<string>`TO_CHAR(${demandas.createdAt} AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')`,
      count: sql<number>`count(*)::int`,
      day: sql`DATE_TRUNC('day', ${demandas.createdAt})`
    }).from(demandas).where(and(eq(demandas.tenantId, tenantId), sql`${demandas.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`)).groupBy(sql`DATE_TRUNC('day', ${demandas.createdAt}), TO_CHAR(${demandas.createdAt} AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')`).orderBy(sql`DATE_TRUNC('day', ${demandas.createdAt}) ASC`);

    // Busca Perfil do Eleitorado (Gênero)
    const [candidato] = await db.select().from(tseCandidatos).where(eq(tseCandidatos.tenantId, tenantId)).limit(1);
    let electorateGender = { masculino: 0, feminino: 0 };
    
    if (candidato) {
      const genderStats = await db.execute(sql`
        SELECT ds_genero as label, SUM(qt_eleitores) as value
        FROM tse_perfil_eleitorado
        WHERE cd_municipio = ${candidato.cdMunicipio} AND ano_eleicao = ${candidato.anoEleicao}
        GROUP BY 1
      `);

      genderStats.rows.forEach((row: any) => {
        if (row.label.toUpperCase() === 'MASCULINO') electorateGender.masculino = Number(row.value);
        if (row.label.toUpperCase() === 'FEMININO') electorateGender.feminino = Number(row.value);
      });
    }

    res.json({
      summary: { 
        total: summary?.total || 0, 
        pending: summary?.pending || 0,
        needsAttention: atendimentoSummary?.needsAttention || 0,
        municipesTotal: municipeSummary?.total || 0,
        birthdaysToday: municipeSummary?.birthdaysToday || 0,
        uniqueBairros: municipeSummary?.uniqueBairros || 0,
        dailyTokenLimit: tenant?.dailyTokenLimit || 0,
        tokenUsageTotal: tenant?.tokenUsageTotal || 0,
        electorateGender // Adicionado
      },
      categoryStats: categoryStats.map(c => ({ ...c, value: Number(c.value) })),
      dailyStats: last7Days.map(d => ({ date: d.date, count: Number(d.count) }))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed' });
  }
};
