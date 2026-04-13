import { Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  const userList = await db.select().from(users).where(eq(users.email, email));
  const user = userList[0];

  if (!user) {
    console.log('Login failed: User not found', email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    console.log('Login failed: Password mismatch for', email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, tenantId: user.tenantId, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  return res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }
  });
};
