import { db } from '../db';
import { atendimentos, municipes } from '../db/schema';
import { eq, sql, count, and } from 'drizzle-orm';

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
    })).sort((a, b) => b.influence_score - a.influence_score);
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
    const stats = await db.execute(sql`
      WITH votos_tse AS (
        SELECT 
          UPPER(nm_bairro) as bairro, 
          SUM(qt_votos) as votos
        FROM tse_votos_secao v
        JOIN tse_locais_votacao l ON v.nr_local_votacao = l.nr_local_votacao 
          AND v.cd_municipio = l.cd_municipio
        WHERE v.nr_candidato = (
          SELECT nr_candidato FROM tse_candidatos WHERE tenant_id = ${tenantId} LIMIT 1
        )
        GROUP BY 1
      ),
      contatos_crm AS (
        SELECT 
          UPPER(bairro) as bairro, 
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
      WHERE v.votos > 500
      ORDER BY conversion_rate ASC
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
 * Orquestra o "Combo D": Plano de Ação Completo.
 */
export const executeExpansionPlan = async (tenantId: string, bairro: string) => {
  try {
    // 1. Identificar Aliados influentes no bairro
    const aliados = await getInfluentialMunicipes(tenantId, bairro);

    // 2. Simular criação de tarefa no Kanban (ideal seria injetar o KanbanService)
    console.log(`[INTELLIGENCE] Criando tarefa no Kanban para visita em ${bairro}`);

    // 3. Gerar sugestão de conteúdo via IA
    // Em produção: chamar o aiService passando as categorias de demandas do bairro
    const aiSuggestion = {
      roteiro_reels: `Roteiro: Falar sobre as melhorias em ${bairro} e pedir apoio aos lideres locais.`,
      post_whatsapp: `Olá vizinhos de ${bairro}, o gabinete está atuando firme na região...`
    };

    return {
      status: 'success',
      bairro,
      aliados: aliados.length,
      tasks: 1,
      aiSuggestion
    };
  } catch (error) {
    console.error('[INTELLIGENCE SERVICE] Error executing expansion plan:', error);
    return { status: 'error', message: 'Failed to execute plan' };
  }
};
