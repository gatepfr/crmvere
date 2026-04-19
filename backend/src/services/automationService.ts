import cron from 'node-cron';
import { db } from '../db';
import { tenants, municipes, atendimentos, demandas } from '../db/schema';
import { eq, sql, and, lt } from 'drizzle-orm';
import { EvolutionService } from './evolutionService';

/**
 * Inicia os agendamentos automáticos do sistema.
 */
export const initAutomations = () => {
  // Todo dia às 08:00 AM — aniversariantes
  cron.schedule('0 8 * * *', async () => {
    console.log('[AUTOMATION] Iniciando verificação de aniversariantes às 08:00...');
    await processBirthdayAutomations();
  }, { timezone: 'America/Sao_Paulo' });

  // Todo dia às 09:00 — follow-up de atendimentos pendentes
  cron.schedule('0 9 * * *', async () => {
    console.log('[AUTOMATION] Iniciando follow-up de atendimentos às 09:00...');
    await processFollowUpAutomations();
  }, { timezone: 'America/Sao_Paulo' });

  // Toda segunda-feira às 08:00 — relatório semanal
  cron.schedule('0 8 * * 1', async () => {
    console.log('[AUTOMATION] Iniciando relatório semanal às 08:00 de segunda...');
    await processWeeklyReport();
  }, { timezone: 'America/Sao_Paulo' });
};

/**
 * Varre todos os tenants e envia mensagens para aniversariantes do dia
 * caso a automação esteja ativa.
 */
const processBirthdayAutomations = async () => {
  try {
    const allTenants = await db.select().from(tenants).where(eq(tenants.active, true));

    for (const tenant of allTenants) {
      if (!tenant.birthdayAutomated || !tenant.birthdayMessage || !tenant.evolutionApiUrl || !tenant.evolutionGlobalToken || !tenant.whatsappInstanceId) {
        continue;
      }

      console.log(`[AUTOMATION] Processando aniversários para tenant: ${tenant.name}`);

      // Inicializa o serviço da Evolution para este tenant
      const evolution = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);

      // Busca munícipes que fazem aniversário HOJE (Dia e Mês)
      const birthdayBoys = await db.execute(sql`
        SELECT name, phone
        FROM municipes
        WHERE tenant_id = ${tenant.id}
          AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      `);

      for (const municipe of birthdayBoys.rows as any[]) {
        try {
          const message = tenant.birthdayMessage.replace('{nome}', municipe.name);

          await evolution.sendMessage(
            tenant.whatsappInstanceId,
            municipe.phone,
            message
          );

          console.log(`[AUTOMATION] Mensagem de aniversário enviada para ${municipe.name} (${tenant.name})`);
        } catch (err) {
          console.error(`[AUTOMATION] Erro ao enviar para ${municipe.name}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[AUTOMATION] Erro crítico no processamento de aniversários:', error);
  }
};

/**
 * Envia follow-up via WhatsApp para atendimentos marcados como "precisa retorno"
 * que não foram atualizados há N dias (configurável por tenant).
 */
const processFollowUpAutomations = async () => {
  try {
    const allTenants = await db.select().from(tenants).where(
      and(eq(tenants.active, true), eq(tenants.followUpEnabled, true))
    );

    for (const tenant of allTenants) {
      if (!tenant.whatsappInstanceId || !tenant.evolutionApiUrl || !tenant.evolutionGlobalToken) {
        continue;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - tenant.followUpDays);

      const pendingAtendimentos = await db
        .select({
          id: atendimentos.id,
          municipeName: municipes.name,
          municipePhone: municipes.phone,
        })
        .from(atendimentos)
        .innerJoin(municipes, eq(atendimentos.municipeId, municipes.id))
        .where(
          and(
            eq(atendimentos.tenantId, tenant.id),
            eq(atendimentos.precisaRetorno, true),
            lt(atendimentos.updatedAt, cutoffDate)
          )
        );

      if (pendingAtendimentos.length === 0) continue;

      const DEFAULT_FOLLOWUP_MSG = 'Olá {nome}, passamos para informar que sua solicitação está sendo acompanhada pelo gabinete. Em breve teremos uma atualização para você. Obrigado pela paciência!';
      const template = tenant.followUpMessage || DEFAULT_FOLLOWUP_MSG;
      const evolution = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);

      for (const item of pendingAtendimentos) {
        try {
          const message = template.replace(/{nome}/g, item.municipeName);
          await evolution.sendMessage(tenant.whatsappInstanceId, item.municipePhone, message);

          // Atualiza updatedAt para não reenviar no próximo ciclo
          await db.update(atendimentos)
            .set({ updatedAt: new Date() })
            .where(eq(atendimentos.id, item.id));

          console.log(`[FOLLOW-UP] Enviado para ${item.municipeName} (${tenant.name})`);
        } catch (err) {
          console.error(`[FOLLOW-UP] Erro ao enviar para ${item.municipeName}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[FOLLOW-UP] Erro crítico:', error);
  }
};

/**
 * Envia relatório semanal com métricas do gabinete para os números configurados.
 */
const processWeeklyReport = async () => {
  try {
    const allTenants = await db.select().from(tenants).where(eq(tenants.active, true));

    for (const tenant of allTenants) {
      const hasNotification = tenant.whatsappNotificationNumber || tenant.whatsappVereadorNumber;
      if (!tenant.whatsappInstanceId || !tenant.evolutionApiUrl || !tenant.evolutionGlobalToken || !hasNotification) {
        continue;
      }

      // Datas da semana anterior
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      // Atendimentos na semana
      const [atendimentoCount] = await db.select({
        total: sql<number>`count(*)::int`
      }).from(atendimentos).where(
        and(
          eq(atendimentos.tenantId, tenant.id),
          sql`${atendimentos.createdAt} >= ${weekStart}`
        )
      );

      // Indicações na semana (demandas com isLegislativo = true)
      const [indicacoesCount] = await db.select({
        total: sql<number>`count(*)::int`
      }).from(demandas).where(
        and(
          eq(demandas.tenantId, tenant.id),
          eq(demandas.isLegislativo, true),
          sql`${demandas.createdAt} >= ${weekStart}`
        )
      );

      // Aniversariantes nos próximos 7 dias
      const [birthdayCount] = await db.select({
        total: sql<number>`count(*)::int`
      }).from(municipes).where(
        and(
          eq(municipes.tenantId, tenant.id),
          sql`to_char(${municipes.birthDate}, 'DD-MM') IN (
            SELECT to_char(CURRENT_DATE + s.a, 'DD-MM')
            FROM generate_series(0, 6) AS s(a)
          )`
        )
      );

      // Bairro mais ativo na semana
      const bairroResult = await db.select({
        bairro: municipes.bairro,
        total: sql<number>`count(*)::int`
      })
      .from(atendimentos)
      .innerJoin(municipes, eq(atendimentos.municipeId, municipes.id))
      .where(
        and(
          eq(atendimentos.tenantId, tenant.id),
          sql`${atendimentos.createdAt} >= ${weekStart}`,
          sql`${municipes.bairro} is not null`
        )
      )
      .groupBy(municipes.bairro)
      .orderBy(sql`count(*) desc`)
      .limit(1);

      const bairroAtivo = bairroResult[0]?.bairro || 'Não identificado';

      const weekStartStr = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const weekEndStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      const message = [
        `📊 *Relatório Semanal do Gabinete*`,
        `Semana de ${weekStartStr} a ${weekEndStr}`,
        ``,
        `🗣️ Atendimentos na semana: ${atendimentoCount?.total || 0}`,
        `📋 Indicações realizadas: ${indicacoesCount?.total || 0}`,
        `🎂 Aniversariantes nos próximos 7 dias: ${birthdayCount?.total || 0}`,
        `📍 Bairro mais ativo: ${bairroAtivo}`,
        ``,
        `_Enviado automaticamente pelo CRM Verê_`
      ].join('\n');

      const evolution = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);

      const recipients = [
        tenant.whatsappNotificationNumber,
        tenant.whatsappVereadorNumber
      ].filter(Boolean) as string[];

      // Remover duplicatas caso os dois números sejam iguais
      const uniqueRecipients = [...new Set(recipients.map(n => n.replace(/\D/g, '')))];

      for (const number of uniqueRecipients) {
        try {
          await evolution.sendMessage(tenant.whatsappInstanceId, number, message);
          console.log(`[WEEKLY-REPORT] Enviado para ${number} (${tenant.name})`);
        } catch (err) {
          console.error(`[WEEKLY-REPORT] Erro ao enviar para ${number}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[WEEKLY-REPORT] Erro crítico:', error);
  }
};
