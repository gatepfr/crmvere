import cron from 'node-cron';
import { db } from '../db';
import { tenants, municipes } from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { EvolutionService } from './evolutionService';

/**
 * Inicia os agendamentos automáticos do sistema.
 */
export const initAutomations = () => {
  // Todo dia às 08:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[AUTOMATION] Iniciando verificação de aniversariantes às 08:00...');
    await processBirthdayAutomations();
  });
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
