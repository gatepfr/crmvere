import { db } from '../db';
import { atendimentos, municipes, tenants, campaigns, campaignColumns, leads, demandas } from '../db/schema';
import { eq, sql, count, and, desc } from 'drizzle-orm';
import { generateStrategicContent } from './aiService';

/**
 * Lógica central de pontuação de influência de um munícipe.
 * Baseada no "Combo 4" do Brainstorm: Engajamento + Tags Manuais.
 */
export const calculateInfluenceScore = (atendimentosCount: number, isLideranca: boolean) => {
  let score = atendimentosCount * 10; // Cada demanda resolvida vale 10 pontos
  if (isLideranca) score += 50;       // Ser líder de bairro vale 50 pontos fixos
  return score;
};

/**
 * Busca munícipes influentes em um determinado bairro para um tenant.
 * Prioriza quem tem maior score de influência.
 */
export const getInfluentialMunicipes = async (tenantId: string, bairro: string) => {
  try {
    const results = await db.execute(sql`
      WITH engajamento AS (
        SELECT 
          m.id, 
          m.name, 
          m.phone, 
          m.bairro,
          COUNT(a.id)::int as atendimentos_concluidos,
          EXISTS(
            SELECT 1 FROM demand_categories dc 
            WHERE dc.tenant_id = ${tenantId} AND dc.name ILIKE '%Liderança%'
          ) as is_lideranca
        FROM municipes m
        LEFT JOIN atendimentos a ON a.municipe_id = m.id AND a.tenant_id = m.tenant_id
        WHERE m.tenant_id = ${tenantId} 
          AND UPPER(m.bairro) = UPPER(${bairro})
        GROUP BY m.id
      )
      SELECT * FROM engajamento
      ORDER BY atendimentos_concluidos DESC, is_lideranca DESC
      LIMIT 20
    `);

    return results.rows.map((row: any) => ({
      ...row,
      influence_score: calculateInfluenceScore(row.atendimentos_concluidos, row.is_lideranca)
    })).sort((a: any, b: any) => b.influence_score - a.influence_score);
  } catch (error) {
    console.error('[INTELLIGENCE SERVICE] Error fetching influential municipes:', error);
    return [];
  }
};

/**
 * Identifica "Vácuos Eleitorais Críticos" comparando votos TSE vs contatos CRM.
 * Critério: Votos > 500 E Conversão < 10%.
 */
export const identifyStrategicVacuums = async (tenantId: string) => {
  try {
    // 1. Busca o candidato configurado para este tenant
    const candidatoResult = await db.execute(sql`SELECT * FROM tse_candidatos WHERE tenant_id = ${tenantId} LIMIT 1`);
    const candidato = candidatoResult.rows[0] as any;
    
    if (!candidato) return [];

    const stats = await db.execute(sql`
      WITH total_votos_local AS (
        SELECT 
          nr_zona, 
          nr_local_votacao, 
          SUM(qt_votos) as votos
        FROM tse_votos_secao
        WHERE nr_candidato = ${candidato.nr_candidato}
          AND cd_municipio = ${candidato.cd_municipio}
          AND ano_eleicao = ${candidato.ano_eleicao}
        GROUP BY 1, 2
      ),
      bairros_mapeados AS (
        SELECT DISTINCT ON (nr_zona, nr_local_votacao)
          nr_zona, 
          nr_local_votacao, 
          UPPER(COALESCE(NULLIF(nm_bairro, ''), 'CENTRO')) as bairro
        FROM tse_locais_votacao
        WHERE cd_municipio = ${candidato.cd_municipio}
          AND ano_eleicao = ${candidato.ano_eleicao}
      ),
      votos_tse AS (
        SELECT 
          b.bairro,
          SUM(v.votos) as votos
        FROM total_votos_local v
        JOIN bairros_mapeados b ON v.nr_local_votacao = b.nr_local_votacao 
          AND v.nr_zona = b.nr_zona
        GROUP BY 1
      ),
      contatos_crm AS (
        SELECT 
          UPPER(COALESCE(NULLIF(bairro, ''), 'CENTRO')) as bairro, 
          COUNT(id) as contatos
        FROM municipes
        WHERE tenant_id = ${tenantId}
        GROUP BY 1
      )
      SELECT 
        v.bairro,
        v.votos::int as total_votos,
        COALESCE(c.contatos, 0)::int as total_contatos,
        (COALESCE(c.contatos, 0)::float / NULLIF(v.votos, 0)) as conversion_rate
      FROM votos_tse v
      LEFT JOIN contatos_crm c ON v.bairro = c.bairro
      WHERE v.votos > 10 -- Mostra até bairros pequenos, mas prioriza no ranking
      ORDER BY total_votos DESC
    `);

    return stats.rows.map((row: any) => {
      const isVacuum = row.conversion_rate < 0.10;
      return {
        ...row,
        category: isVacuum ? 'VACUO' : (row.conversion_rate < 0.30 ? 'POTENCIAL' : 'CONSOLIDADO'),
        priority: row.conversion_rate < 0.05 ? 'URGENTE' : (isVacuum ? 'ALTA' : 'NORMAL')
      };
    });
  } catch (error) {
    console.error('[INTELLIGENCE SERVICE] Error identifying strategic vacuums:', error);
    return [];
  }
};

/**
 * Orquestra o "Combo D": Plano de Ação Completo Real.
 */
export const executeExpansionPlan = async (tenantId: string, bairro: string) => {
  try {
    // 1. Buscar Configurações de IA do Tenant
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    
    // 2. Identificar a principal demanda do bairro para contextualizar a IA
    const topDemanda = await db.execute(sql`
      SELECT categoria, COUNT(*) as qtd 
      FROM demandas 
      WHERE tenant_id = ${tenantId} AND UPPER(descricao) LIKE ${'%' + bairro.toUpperCase() + '%'}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    `);
    const demandaPrincipal = topDemanda.rows[0]?.categoria || "Melhorias Gerais";

    // 3. Chamar a IA Real para gerar conteúdo
    let aiContent = { reels: "", post: "" };
    if (tenant?.aiApiKey) {
      aiContent = await generateStrategicContent(bairro, demandaPrincipal, {
        provider: tenant.aiProvider as any,
        apiKey: tenant.aiApiKey,
        model: tenant.aiModel || 'gemini-1.5-flash',
        systemPrompt: tenant.systemPrompt || ''
      });
    }

    // 4. Criar Campanha e Tarefa no Kanban (Funil de Leads)
    let [campanha] = await db.select().from(campaigns).where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.name, 'Estratégia Territorial'))).limit(1);
    if (!campanha) {
      [campanha] = await db.insert(campaigns).values({ tenantId, name: 'Estratégia Territorial' }).returning();
      const cols = ['Planejamento', 'Em Visita', 'Concluído'];
      for (let i = 0; i < cols.length; i++) {
        await db.insert(campaignColumns).values({ campaignId: campanha.id, name: cols[i], order: i });
      }
    }

    const [coluna] = await db.select().from(campaignColumns).where(eq(campaignColumns.campaignId, campanha.id)).orderBy(campaignColumns.order).limit(1);
    
    await db.insert(leads).values({
      tenantId,
      campaignId: campanha.id,
      columnId: coluna.id,
      name: `VISITA: ${bairro.toUpperCase()}`,
      notes: `Plano de Expansão gerado via Inteligência Eleitoral.\n\nDemanda Foco: ${demandaPrincipal}\n\nROTEIRO IA:\n${aiContent.reels}\n\nLEGENDA IA:\n${aiContent.post}`
    });

    // 5. Buscar os Aliados VIPs para o retorno
    const aliados = await getInfluentialMunicipes(tenantId, bairro);

    return {
      status: 'success',
      bairro,
      aliados: aliados.map((a: any) => ({ name: a.name, phone: a.phone, score: a.influence_score })),
      aiSuggestion: {
        reels: aiContent.reels,
        post: aiContent.post
      }
    };
  } catch (error) {
    console.error('[INTELLIGENCE SERVICE] Error executing expansion plan:', error);
    return { status: 'error', message: 'Failed to execute plan' };
  }
};
