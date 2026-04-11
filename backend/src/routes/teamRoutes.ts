import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// GET /api/team - List members of the cabinet
router.get('/', async (req: any, res: any) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  const members = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt
  }).from(users).where(eq(users.tenantId, tenantId));
  
  res.json(members);
});

// POST /api/team - Add new assessor
router.post('/', async (req: any, res: any) => {
  const tenantId = req.user?.tenantId;
  const { email } = req.body;
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  if (req.user?.role === 'assessor') return res.status(403).json({ error: 'Only admins can add members' });

  const passwordHash = await bcrypt.hash('assessor123', 12);
  
  try {
    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
      role: 'assessor',
      tenantId
    } as any).returning({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    });
    res.status(201).json(newUser);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'User already exists' });
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/team/:id - Remove member
router.delete('/:id', async (req: any, res: any) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  if (req.user?.role === 'assessor') return res.status(403).json({ error: 'Only admins can remove members' });
  if (id === req.user?.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  await db.delete(users).where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
  res.json({ success: true });
});

export default router;
