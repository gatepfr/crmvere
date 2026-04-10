import type { Request, Response } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';

export const createTenant = async (req: Request, res: Response) => {
  const { name, slug } = req.body;
  
  if (!name || !slug) {
    res.status(400).json({ error: 'Name and slug are required' });
    return;
  }
  
  try {
    const [newTenant] = await db.insert(tenants).values({ name, slug }).returning();
    res.status(201).json(newTenant);
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation (slug)
      res.status(400).json({ error: 'Slug already exists' });
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
