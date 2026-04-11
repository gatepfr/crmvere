import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

router.patch('/password', async (req, res) => {
  const userId = req.user?.id;
  const { newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId!));
  
  res.json({ success: true });
});

export default router;
