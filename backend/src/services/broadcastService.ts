import { db } from '../db';
import { broadcasts, broadcastRecipients, optouts, municipes, tenants, demandas } from '../db/schema';
import { eq, and, inArray, sql, notInArray } from 'drizzle-orm';
import { EvolutionService } from './evolutionService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export async function resolveSegment(
  tenantId: string,
  segmentType: string,
  segmentValue?: string
): Promise<Array<{ municipeId: string; phone: string }>> {
  const optoutRows = await db
    .select({ phone: optouts.phone })
    .from(optouts)
    .where(eq(optouts.tenantId, tenantId));

  const optoutPhones = optoutRows.map(r => r.phone);

  let baseQuery = db
    .select({ municipeId: municipes.id, phone: municipes.phone })
    .from(municipes)
    .where(eq(municipes.tenantId, tenantId));

  let rows: Array<{ municipeId: string; phone: string }> = [];

  if (segmentType === 'todos') {
    rows = await baseQuery;
  } else if (segmentType === 'bairro') {
    rows = await db
      .select({ municipeId: municipes.id, phone: municipes.phone })
      .from(municipes)
      .where(and(eq(municipes.tenantId, tenantId), eq(municipes.bairro, segmentValue ?? '')));
  } else if (segmentType === 'lideranca') {
    rows = await db
      .select({ municipeId: municipes.id, phone: municipes.phone })
      .from(municipes)
      .where(and(eq(municipes.tenantId, tenantId), eq(municipes.isLideranca, true)));
  } else if (segmentType === 'aniversariantes') {
    rows = await db
      .select({ municipeId: municipes.id, phone: municipes.phone })
      .from(municipes)
      .where(
        and(
          eq(municipes.tenantId, tenantId),
          sql`EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)`
        )
      );
  } else if (segmentType === 'categoria_demanda') {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const municipeIds = await db
      .selectDistinct({ municipeId: demandas.municipeId })
      .from(demandas)
      .where(
        and(
          eq(demandas.tenantId, tenantId),
          sql`UPPER(${demandas.categoria}) = UPPER(${segmentValue ?? ''})`,
          sql`${demandas.createdAt} >= ${ninetyDaysAgo.toISOString()}`
        )
      );

    const ids = municipeIds.map(r => r.municipeId);
    if (ids.length === 0) return [];

    rows = await db
      .select({ municipeId: municipes.id, phone: municipes.phone })
      .from(municipes)
      .where(and(eq(municipes.tenantId, tenantId), inArray(municipes.id, ids)));
  } else if (segmentType === 'custom') {
    const ids: string[] = JSON.parse(segmentValue ?? '[]');
    if (ids.length === 0) return [];

    rows = await db
      .select({ municipeId: municipes.id, phone: municipes.phone })
      .from(municipes)
      .where(and(eq(municipes.tenantId, tenantId), inArray(municipes.id, ids)));
  }

  if (optoutPhones.length === 0) return rows;
  return rows.filter(r => !optoutPhones.includes(r.phone));
}

export async function queueBroadcast(broadcastId: string): Promise<void> {
  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.id, broadcastId))
    .limit(1);

  if (!broadcast) throw new Error(`Broadcast not found: ${broadcastId}`);

  const recipients = await resolveSegment(
    broadcast.tenantId,
    broadcast.segmentType,
    broadcast.segmentValue ?? undefined
  );

  if (recipients.length > 0) {
    await db.insert(broadcastRecipients).values(
      recipients.map(r => ({
        broadcastId,
        municipeId: r.municipeId,
        phone: r.phone,
        status: 'pendente' as const,
      }))
    );
  }

  await db
    .update(broadcasts)
    .set({ totalRecipients: recipients.length, status: 'enfileirado' })
    .where(eq(broadcasts.id, broadcastId));
}

export async function processQueue(): Promise<void> {
  const enfileirados = await db
    .select({ id: broadcasts.id })
    .from(broadcasts)
    .where(eq(broadcasts.status, 'enfileirado'))
    .limit(5);

  if (enfileirados.length > 0) {
    await db
      .update(broadcasts)
      .set({ status: 'enviando', startedAt: new Date() })
      .where(
        inArray(
          broadcasts.id,
          enfileirados.map(b => b.id)
        )
      );
  }

  const sending = await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.status, 'enviando'))
    .limit(5);

  for (const broadcast of sending) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, broadcast.tenantId))
      .limit(1);

    if (!tenant?.evolutionApiUrl || !tenant?.evolutionGlobalToken || !tenant?.whatsappInstanceId) {
      continue;
    }

    const evolutionService = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);

    const pendingRecipients = await db
      .select()
      .from(broadcastRecipients)
      .where(
        and(
          eq(broadcastRecipients.broadcastId, broadcast.id),
          eq(broadcastRecipients.status, 'pendente')
        )
      )
      .limit(10);

    let sentDelta = 0;
    let failedDelta = 0;

    for (const recipient of pendingRecipients) {
      try {
        await evolutionService.sendMessage(
          tenant.whatsappInstanceId,
          recipient.phone,
          broadcast.message
        );

        await db
          .update(broadcastRecipients)
          .set({ status: 'enviado', sentAt: new Date() })
          .where(eq(broadcastRecipients.id, recipient.id));

        sentDelta++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        await db
          .update(broadcastRecipients)
          .set({ status: 'erro', errorMessage })
          .where(eq(broadcastRecipients.id, recipient.id));

        failedDelta++;
      }

      await sleep(randomBetween(3000, 5000));
    }

    await db
      .update(broadcasts)
      .set({
        sentCount: sql`${broadcasts.sentCount} + ${sentDelta}`,
        failedCount: sql`${broadcasts.failedCount} + ${failedDelta}`,
      })
      .where(eq(broadcasts.id, broadcast.id));

    const [remaining] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(broadcastRecipients)
      .where(
        and(
          eq(broadcastRecipients.broadcastId, broadcast.id),
          eq(broadcastRecipients.status, 'pendente')
        )
      );

    if (Number(remaining.count) === 0) {
      await db
        .update(broadcasts)
        .set({ status: 'concluido', completedAt: new Date() })
        .where(eq(broadcasts.id, broadcast.id));
    }
  }
}

export async function previewSegment(
  tenantId: string,
  segmentType: string,
  segmentValue?: string
): Promise<{ total: number; sample: Array<{ name: string; phone: string }> }> {
  const allRecipients = await resolveSegment(tenantId, segmentType, segmentValue);

  if (allRecipients.length === 0) {
    return { total: 0, sample: [] };
  }

  const sampleIds = allRecipients.slice(0, 20).map(r => r.municipeId);

  const sampleRows = await db
    .select({ name: municipes.name, phone: municipes.phone })
    .from(municipes)
    .where(inArray(municipes.id, sampleIds));

  return { total: allRecipients.length, sample: sampleRows };
}
