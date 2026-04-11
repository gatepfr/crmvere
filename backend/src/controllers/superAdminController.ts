import type { Request, Response } from 'express';
import { db } from '../db';
import { tenants, users } from '../db/schema';
import bcrypt from 'bcryptjs';

export const createTenant = async (req: Request, res: Response) => {
  const { name, slug, email } = req.body;
  
  if (!name || !slug || !email) {
    res.status(400).json({ error: 'Name, slug and email are required' });
    return;
  }
  
  try {
    const passwordHash = await bcrypt.hash('admin123', 12);

    const result = await db.transaction(async (tx) => {
      // 1. Create the tenant
      const [newTenant] = await tx.insert(tenants).values({ name, slug }).returning();
      
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
