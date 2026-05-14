// backend/src/controllers/publicController.ts
import type { Request, Response } from 'express';
import { db } from '../db';
import {
  tenants, municipes, demandas, demandCategories, globalCategories
} from '../db/schema';
import { eq, and, sql, asc } from 'drizzle-orm';
import { normalizePhone } from '../utils/phoneUtils';
import { EvolutionService } from '../services/evolutionService';
import fs from 'fs';
import path from 'path';

// GET /api/public/tenant/:slug
export const getTenantPublicInfo = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  try {
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        municipio: tenants.municipio,
        uf: tenants.uf,
        partido: tenants.partido,
        mandato: tenants.mandato,
        fotoUrl: tenants.fotoUrl,
        active: tenants.active,
        blocked: tenants.blocked,
      })
      .from(tenants)
      .where(eq(tenants.slug, slug));

    if (!tenant || !tenant.active || tenant.blocked) {
      return res.status(404).json({ error: 'Gabinete não encontrado' });
    }

    const tenantCats = await db
      .select({ id: demandCategories.id, name: demandCategories.name, icon: demandCategories.icon, color: demandCategories.color })
      .from(demandCategories)
      .where(eq(demandCategories.tenantId, tenant.id))
      .orderBy(asc(demandCategories.name));

    const categories = tenantCats.length > 0
      ? tenantCats
      : await db
          .select({ id: globalCategories.id, name: globalCategories.name, icon: globalCategories.icon, color: globalCategories.color })
          .from(globalCategories)
          .orderBy(asc(globalCategories.order));

    return res.json({
      name: tenant.name,
      municipio: tenant.municipio,
      uf: tenant.uf,
      partido: tenant.partido,
      mandato: tenant.mandato,
      fotoUrl: tenant.fotoUrl,
      categories,
    });
  } catch (err) {
    console.error('[PUBLIC] getTenantPublicInfo error', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
};

// POST /api/public/demanda/:slug
export const submitPublicDemand = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const { categoriaId, descricao, localizacao, nome, telefone, categoriaDisplay } = req.body;
  const fotoFile = req.file as Express.Multer.File | undefined;

  if (!categoriaId || !descricao || !nome || !telefone) {
    return res.status(400).json({ error: 'Campos obrigatórios: categoriaId, descricao, nome, telefone' });
  }
  if (descricao.length < 10) {
    return res.status(400).json({ error: 'Descrição deve ter ao menos 10 caracteres' });
  }
  if (descricao.length > 10000) {
    return res.status(400).json({ error: 'Descrição muito longa (máximo 10000 caracteres).' });
  }

  try {
    const [tenant] = await db.select({
      id: tenants.id,
      name: tenants.name,
      active: tenants.active,
      blocked: tenants.blocked,
      whatsappInstanceId: tenants.whatsappInstanceId,
      evolutionApiUrl: tenants.evolutionApiUrl,
      evolutionGlobalToken: tenants.evolutionGlobalToken,
      whatsappNotificationNumber: tenants.whatsappNotificationNumber,
    }).from(tenants).where(eq(tenants.slug, slug));
    if (!tenant || !tenant.active || tenant.blocked) {
      return res.status(404).json({ error: 'Gabinete não encontrado' });
    }

    // Resolve category name from ID
    let categoriaNome = 'Outros';
    const [tenantCat] = await db
      .select({ name: demandCategories.name })
      .from(demandCategories)
      .where(and(eq(demandCategories.id, categoriaId), eq(demandCategories.tenantId, tenant.id)));
    if (tenantCat) {
      categoriaNome = tenantCat.name;
    } else {
      const [globalCat] = await db
        .select({ name: globalCategories.name })
        .from(globalCategories)
        .where(eq(globalCategories.id, categoriaId));
      if (globalCat) categoriaNome = globalCat.name;
    }
    if (categoriaDisplay && typeof categoriaDisplay === 'string' && categoriaDisplay.trim()) {
      categoriaNome = categoriaDisplay.trim();
    }

    // Normalize phone
    const phoneNormalized = normalizePhone(telefone);

    // Upsert municipe
    let municipeId: string;
    const [existing] = await db
      .select({ id: municipes.id })
      .from(municipes)
      .where(and(eq(municipes.tenantId, tenant.id), eq(municipes.phone, phoneNormalized)));

    if (existing) {
      municipeId = existing.id;
    } else {
      const [newMunicipe] = await db
        .insert(municipes)
        .values({ tenantId: tenant.id, name: nome, phone: phoneNormalized })
        .returning({ id: municipes.id });
      municipeId = newMunicipe.id;
    }

    // Handle photo upload
    let fotoUrl: string | null = null;
    if (fotoFile) {
      const mimeToExt: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      const ext = mimeToExt[fotoFile.mimetype] ?? 'jpg';
      const fileName = `demanda-${Date.now()}.${ext}`;
      const destDir = path.join(__dirname, '../../uploads', 'demandas');
      fs.mkdirSync(destDir, { recursive: true });
      fs.renameSync(fotoFile.path, path.join(destDir, fileName));
      fotoUrl = `/uploads/demandas/${fileName}`;
    }

    // Generate protocolo: YYYY-NNNN (sequential per tenant per year)
    const year = new Date().getFullYear();
    const protocolResult = await db.execute(
      sql`SELECT COALESCE(MAX(CAST(SPLIT_PART(protocolo, '-', 2) AS INTEGER)), 0) + 1 AS nextval
          FROM demandas
          WHERE tenant_id = ${tenant.id}
            AND protocolo LIKE ${year + '-%'}`
    );
    const nextval = (protocolResult.rows[0] as any)?.nextval ?? 1;
    const protocolo = `${year}-${String(Number(nextval)).padStart(4, '0')}`;

    // Create demand
    await db.insert(demandas).values({
      tenantId: tenant.id,
      municipeId,
      categoria: categoriaNome,
      descricao,
      localizacao: localizacao || null,
      fotoUrl,
      origem: 'formulario_publico',
      protocolo,
      status: 'nova',
      prioridade: 'media',
    });

    // Fire-and-forget WhatsApp messages
    if (tenant.whatsappInstanceId && tenant.evolutionApiUrl && tenant.evolutionGlobalToken) {
      const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
      const localStr = localizacao ? `\n📍 *Local:* ${localizacao}` : '';
      const cidadaoMsg =
        `✅ *Demanda recebida!*\n\nOlá, ${nome}! Sua demanda foi registrada com sucesso no gabinete do ${tenant.name}.\n\n📋 *Protocolo:* #${protocolo}\n📌 *Categoria:* ${categoriaNome}${localStr}\n\nO vereador vai dar andamento o mais breve possível. Obrigado pelo contato!`;
      evo.sendMessage(tenant.whatsappInstanceId, phoneNormalized, cidadaoMsg).catch(() => {});

      if (tenant.whatsappNotificationNumber) {
        const preview = descricao.length > 100 ? descricao.slice(0, 100) + '...' : descricao;
        const teamMsg =
          `🔔 *Nova demanda via formulário público!*\n\n👤 ${nome} — 📱 ${phoneNormalized}\n📌 ${categoriaNome}${localizacao ? ` — 📍 ${localizacao}` : ''}\n📝 ${preview}\n\nAcesse o CRM para visualizar e atribuir.`;
        evo.sendMessage(tenant.whatsappInstanceId, tenant.whatsappNotificationNumber, teamMsg).catch(() => {});
      }
    }

    return res.status(201).json({ protocolo, message: 'Demanda recebida com sucesso!' });
  } catch (err) {
    // cleanup orphaned temp file
    if (fotoFile?.path) {
      try { fs.unlinkSync(fotoFile.path); } catch {}
    }
    console.error('[PUBLIC] submitPublicDemand error', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
};
