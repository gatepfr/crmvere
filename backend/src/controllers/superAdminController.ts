import type { Request, Response } from 'express';
import { db } from '../db';
import { tenants, users, demandas, municipes, systemConfigs, globalCategories } from '../db/schema';
import { eq, sql, asc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { redisService } from '../services/redisService';

export const getGlobalConfig = async (_req: Request, res: Response) => {
  try {
    let [config] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
    
    if (!config) {
      // Create default if not exists
      [config] = await db.insert(systemConfigs).values({ id: 'default', defaultDailyTokenLimit: 50000 }).returning();
    }
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global config' });
  }
};

export const updateGlobalConfig = async (req: Request, res: Response) => {
  const { defaultDailyTokenLimit, aiProvider, aiApiKey, aiModel, aiBaseUrl } = req.body;
  try {
    const updateData: any = { updatedAt: new Date() };
    if (defaultDailyTokenLimit !== undefined) updateData.defaultDailyTokenLimit = defaultDailyTokenLimit;
    if (aiProvider) updateData.aiProvider = aiProvider;
    if (aiApiKey !== undefined) updateData.aiApiKey = aiApiKey;
    if (aiModel) updateData.aiModel = aiModel;
    if (aiBaseUrl !== undefined) updateData.aiBaseUrl = aiBaseUrl;

    const [config] = await db.insert(systemConfigs)
      .values({ id: 'default', ...updateData })
      .onConflictDoUpdate({
        target: systemConfigs.id,
        set: updateData
      })
      .returning();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update global config' });
  }
};

export const getSystemStats = async (_req: Request, res: Response) => {
  try {
    const [tenantsCount] = await db.select({ count: sql<number>`count(*)` }).from(tenants);
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [demandasCount] = await db.select({ count: sql<number>`count(*)` }).from(demandas);
    const [municipesCount] = await db.select({ count: sql<number>`count(*)` }).from(municipes);

    res.status(200).json({
      tenants: Number(tenantsCount?.count || 0),
      users: Number(usersCount?.count || 0),
      demandas: Number(demandasCount?.count || 0),
      municipes: Number(municipesCount?.count || 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
};

export const listAllUsers = async (_req: Request, res: Response) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      tenantId: users.tenantId,
      createdAt: users.createdAt,
      tenantName: tenants.name
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(sql`${users.role} != 'super_admin'`);

    res.status(200).json(allUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list all users' });
  }
};

export const resetUserPassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const passwordHash = await bcrypt.hash('admin123', 12);
    await db.update(users)
      .set({ passwordHash, passwordResetToken: null, passwordResetExpires: null })
      .where(eq(users.id, id as string));
    
    res.json({ success: true, message: 'Password reset to default (admin123) successfully' });
  } catch (error) {
    console.error('Error resetting user password:', error);
    res.status(500).json({ error: 'Failed to reset user password' });
  }
};

export const resetDatabase = async (_req: Request, res: Response) => {
  try {
    await db.transaction(async (tx) => {
      // Order matters due to foreign keys
      await tx.execute(sql`TRUNCATE demandas, municipes, documents, leads, campaign_columns, campaigns RESTART IDENTITY CASCADE;`);
    });
    
    res.json({ success: true, message: 'Database reset successfully' });
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({ error: 'Failed to reset database' });
  }
};

const DEFAULT_SYSTEM_PROMPT = `PARTE 1, IDENTIDADE DO AGENTE

Você é a Gabi, assistente virtual do gabinete.

Sua função é atender cidadãos via WhatsApp, registrando, organizando e encaminhando demandas para a equipe responsável.

Seu comportamento deve ser:

* Educado, acessível e respeitoso
* Objetivo e organizado
* Próximo da população, linguagem simples
* Sempre focado em ajudar e direcionar corretamente

Você representa o gabinete, nunca uma pessoa física.

Pode usar internamente o BANCO DE DADOS para obter informações sobre o vereador, Câmara e ações do mandato. Nunca mencione isso ao usuário.

PARTE 2, CONTEXTO DE ATUAÇÃO

Você atende munícipes que entram em contato via WhatsApp.

As demandas podem ser:

* Reclamações
* Pedidos de ajuda
* Dúvidas
* Elogios

Seu papel é:

1. Acolher
2. Entender
3. Coletar informações
4. Organizar
5. Encaminhar via CRM

PARTE 3, TOM DE VOZ

Use sempre:

* Linguagem simples
* Tom humano e próximo
* Clareza e objetividade
* Empatia quando necessário

Evite:

* Linguagem técnica
* Respostas robóticas
* Textos longos
* Formalidade excessiva

PARTE 4, TOMADA DE DECISÃO

Classifique a mensagem: Reclamação | Dúvida | Elogio | Urgente

Reclamações: demonstre empatia, solicite bairro, rua, referência e foto, confirme registro.
Dúvidas: responda com clareza; se não souber, informe que vai verificar.
Elogios: "Obrigado pela mensagem 😊 Isso é muito importante pra gente!"
Urgentes: priorize e colete dados rapidamente.

REGISTRO PARA CRM (OBRIGATÓRIO): Nome | Bairro | Tipo | Descrição | Urgência

PARTE 5, REGRAS

Você PODE: registrar, organizar, orientar, informar, encaminhar.

Você NÃO PODE: prometer prazos ou soluções, opinar politicamente, discutir política ou religião, conflitar, inventar informações, oferecer benefícios.

Resposta padrão: "Essa parte precisa ser verificada com a equipe, tudo bem? Vou encaminhar."

PARTE 6, ESCALONAMENTO

Encaminhe quando: usuário insatisfeito, insistência, caso sensível/urgente ou pedido para falar com humano.
Após encaminhar (precisa_retorno = true), pare a conversa.

PARTE 7, SCRIPTS

Abertura: "Oi! Eu sou a Gabi, assistente do gabinete. Como posso te ajudar?"
Coleta: "Pode me passar mais detalhes pra eu registrar certinho?"
Localização: "Qual o bairro e a rua? Se tiver referência ajuda 👍"
Confirmação: "Perfeito, já registrei 🙌 Vou encaminhar pra equipe."
Encerramento: "Se precisar de algo mais, pode me chamar 👍"`;

export const createTenant = async (req: Request, res: Response) => {
  const { name, slug, email } = req.body;
  
  if (!name || !slug || !email) {
    res.status(400).json({ error: 'Name, slug and email are required' });
    return;
  }
  
  try {
    // Get default limit
    const [config] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
    const defaultLimit = config?.defaultDailyTokenLimit || 50000;

    const passwordHash = await bcrypt.hash('admin123', 12);

    const result = await db.transaction(async (tx) => {
      // 1. Create the tenant
      const [newTenant] = await tx.insert(tenants).values({
        name,
        slug,
        dailyTokenLimit: defaultLimit,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        birthdayMessage: 'Olá {nome}, parabéns pelo seu aniversário! Desejamos muita saúde, paz e realizações. Conte sempre conosco! 🎂🎈',
        legislativeMessage: 'Olá {nome}! Gostaria de informar que sua solicitação sobre *{assunto}* virou a Indicação oficial nº *{numero}*. Você pode acompanhar por aqui: {link}'
      }).returning();
      if (!newTenant) {
        throw new Error('Failed to create tenant');
      }

      // 2. Create the admin user for this tenant
      await tx.insert(users).values({
        email,
        passwordHash,
        role: 'admin',
        tenantId: newTenant.id
      });

      return newTenant;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating tenant:', error);
    if (error.code === '23505') { // Unique constraint violation (slug or email)
      res.status(400).json({ error: 'Slug or email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create tenant' });
  }
};

export const listTenants = async (_req: Request, res: Response) => {
  try {
    const allTenants = await db.select().from(tenants);
    res.status(200).json(allTenants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tenants' });
  }
};

export const updateTenant = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { 
    name, 
    slug, 
    active, 
    dailyTokenLimit, 
    blocked, 
    tokenAdjustment,
    aiProvider,
    aiApiKey,
    aiModel,
    aiBaseUrl,
    birthdayMessage,
    legislativeMessage
  } = req.body;
  
  try {
    const updateData: any = {};
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;
    if (active !== undefined) updateData.active = active;
    if (blocked !== undefined) updateData.blocked = blocked;
    if (aiProvider) updateData.aiProvider = aiProvider;
    if (aiApiKey !== undefined) updateData.aiApiKey = aiApiKey;
    if (aiModel) updateData.aiModel = aiModel;
    if (aiBaseUrl !== undefined) updateData.aiBaseUrl = aiBaseUrl;
    if (birthdayMessage !== undefined) updateData.birthdayMessage = birthdayMessage;
    if (legislativeMessage !== undefined) updateData.legislativeMessage = legislativeMessage;
    
    // Logic for token limit update
    if (tokenAdjustment !== undefined) {
      // Relative adjustment (add/subtract)
      const [current] = await db.select({ limit: tenants.dailyTokenLimit }).from(tenants).where(eq(tenants.id, id));
      updateData.dailyTokenLimit = Math.max(0, (current?.limit || 0) + tokenAdjustment);
    } else if (dailyTokenLimit !== undefined) {
      // Direct overwrite
      updateData.dailyTokenLimit = dailyTokenLimit;
    }

    const [updated] = await db.update(tenants)
      .set(updateData)
      .where(eq(tenants.id, id))
      .returning();
    
    if (!updated) return res.status(404).json({ error: 'Tenant not found' });

    // Sync changes to Redis
    if (updateData.dailyTokenLimit !== undefined) await redisService.setLimit(id, updateData.dailyTokenLimit);
    if (blocked !== undefined) await redisService.setBlockedStatus(id, blocked);

    res.json(updated);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
};


export const deleteTenant = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  
  try {
    await db.transaction(async (tx) => {
      // Although we have cascade in DB, sometimes it's safer to clear manually 
      // or check for dependencies that might block
      await tx.delete(users).where(eq(users.tenantId, id));
      await tx.delete(tenants).where(eq(tenants.id, id));
    });
    
    // Cleanup Redis
    await redisService.invalidateCache(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
};

export const updateSubscriptionStatus = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { status, trialEndsAt, isManual } = req.body;

  try {
    const updateData: any = {
      subscriptionStatus: status,
      isManual: isManual ?? true
    };

    if (trialEndsAt) {
      updateData.trialEndsAt = new Date(trialEndsAt);
    }

    const [updated] = await db.update(tenants)
      .set(updateData)
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Tenant not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating subscription status:', error);
    res.status(500).json({ error: 'Failed to update subscription status' });
  }
};

// --- Global Categories ---

export const listGlobalCategories = async (_req: Request, res: Response) => {
  try {
    const cats = await db.select().from(globalCategories).orderBy(asc(globalCategories.order));
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list global categories' });
  }
};

export const createGlobalCategory = async (req: Request, res: Response) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const existing = await db.select({ order: globalCategories.order }).from(globalCategories).orderBy(asc(globalCategories.order));
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(c => c.order)) + 1 : 1;
    const [cat] = await db.insert(globalCategories)
      .values({ name: name.toUpperCase().trim(), color: color || '#2563eb', icon: icon || 'Tag', order: nextOrder })
      .returning();
    res.status(201).json(cat);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'Category already exists' });
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateGlobalCategory = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, color, icon, order } = req.body;
  try {
    const updateData: any = { updatedAt: new Date() };
    if (name) updateData.name = name.toUpperCase().trim();
    if (color) updateData.color = color;
    if (icon) updateData.icon = icon;
    if (order !== undefined) updateData.order = order;
    const [updated] = await db.update(globalCategories).set(updateData).where(eq(globalCategories.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Category not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteGlobalCategory = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    await db.delete(globalCategories).where(eq(globalCategories.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

