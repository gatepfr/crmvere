import { db } from '../db';
import { municipes, demandas, leads } from '../db/schema';
import { normalizePhone } from '../utils/phoneUtils';
import { eq, and, ne } from 'drizzle-orm';

async function cleanup() {
  console.log('--- INICIANDO LIMPEZA DE MUNICIPES DUPLICADOS ---');
  
  const allMunicipes = await db.select().from(municipes);
  console.log(`Total de munícipes encontrados: ${allMunicipes.length}`);

  const processedCount = {
    normalized: 0,
    merged: 0,
    errors: 0
  };

  for (const municipe of allMunicipes) {
    const normalized = normalizePhone(municipe.phone);
    
    if (municipe.phone !== normalized) {
      try {
        // Tenta atualizar para o número normalizado
        await db.update(municipes)
          .set({ phone: normalized })
          .where(eq(municipes.id, municipe.id));
        
        processedCount.normalized++;
        console.log(`Normalizado: ${municipe.phone} -> ${normalized}`);
      } catch (error: any) {
        // Se falhar (provavelmente por unique constraint se já existir outro), precisamos mesclar
        if (error.code === '23505' || error.message.includes('unique')) {
          console.log(`Conflito ao normalizar ${municipe.phone} -> ${normalized}. Mesclando registros...`);
          
          // Encontra o munícipe que já tem esse número normalizado
          const [existing] = await db.select()
            .from(municipes)
            .where(and(
              eq(municipes.phone, normalized),
              eq(municipes.tenantId, municipe.tenantId!),
              ne(municipes.id, municipe.id)
            ));

          if (existing) {
            try {
              // 1. Move demandas do duplicado para o existente
              await db.update(demandas)
                .set({ municipeId: existing.id })
                .where(eq(demandas.municipeId, municipe.id));
              
              // 2. Move leads do duplicado para o existente
              await db.update(leads)
                .set({ municipeId: existing.id })
                .where(eq(leads.municipeId, municipe.id));

              // 3. Deleta o duplicado
              await db.delete(municipes)
                .where(eq(municipes.id, municipe.id));
              
              processedCount.merged++;
              console.log(`Mesclado com sucesso: ID ${municipe.id} removido, dados movidos para ID ${existing.id}`);
            } catch (mergeError: any) {
              console.error(`Erro ao mesclar munícipe ${municipe.id}:`, mergeError.message);
              processedCount.errors++;
            }
          } else {
            console.error(`Inconsistência: Erro de unicidade mas registro existente não encontrado para ${normalized}`);
            processedCount.errors++;
          }
        } else {
          console.error(`Erro inesperado ao processar munícipe ${municipe.id}:`, error.message);
          processedCount.errors++;
        }
      }
    }
  }

  // Agora vamos procurar duplicados que já tem o MESMO número (ex: importações repetidas antes da trava)
  const remainingMunicipes = await db.select().from(municipes);
  const groups: Record<string, string[]> = {};
  
  for (const m of remainingMunicipes) {
    const key = `${m.tenantId}_${m.phone}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m.id);
  }

  for (const key in groups) {
    const ids = groups[key];
    if (ids.length > 1) {
      console.log(`Encontrados ${ids.length} registros para ${key}. Mesclando...`);
      const survivorId = ids[0];
      const duplicates = ids.slice(1);

      for (const dupeId of duplicates) {
        try {
          await db.update(demandas).set({ municipeId: survivorId }).where(eq(demandas.municipeId, dupeId));
          await db.update(leads).set({ municipeId: survivorId }).where(eq(leads.municipeId, dupeId));
          await db.delete(municipes).where(eq(municipes.id, dupeId));
          processedCount.merged++;
          console.log(`Mesclado duplicado exato: ID ${dupeId} -> ${survivorId}`);
        } catch (e: any) {
          console.error(`Erro ao mesclar duplicado exato ${dupeId}:`, e.message);
          processedCount.errors++;
        }
      }
    }
  }

  console.log('--- RESUMO DA LIMPEZA ---');
  console.log(`Normalizados: ${processedCount.normalized}`);
  console.log(`Mesclados/Removidos: ${processedCount.merged}`);
  console.log(`Erros: ${processedCount.errors}`);
  console.log('-------------------------');
}

cleanup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha crítica na limpeza:', err);
    process.exit(1);
  });
