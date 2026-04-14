import { Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendResetPasswordEmail } from '../services/emailService';

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório' });
  }

  try {
    const userList = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    const user = userList[0];

    if (!user) {
      // Don't reveal if user exists for security, but say check email
      return res.json({ message: 'Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour from now

    await db.update(users)
      .set({ passwordResetToken: token, passwordResetExpires: expires })
      .where(eq(users.id, user.id));

    await sendResetPasswordEmail(user.email, token);

    return res.json({ message: 'Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Erro ao processar solicitação' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
  }

  try {
    const userList = await db.select().from(users).where(
      and(
        eq(users.passwordResetToken, token),
        gt(users.passwordResetExpires, new Date())
      )
    );
    const user = userList[0];

    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.update(users)
      .set({ 
        passwordHash, 
        passwordResetToken: null, 
        passwordResetExpires: null 
      })
      .where(eq(users.id, user.id));

    return res.json({ message: 'Senha redefinida com sucesso!' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  // Trim to avoid whitespace issues
  const cleanEmail = email?.trim().toLowerCase();
  const cleanPassword = password?.trim();

  if (!cleanEmail || !cleanPassword) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  const userList = await db.select().from(users).where(eq(users.email, cleanEmail));
  const user = userList[0];

  if (!user) {
    console.log('Login failed: User not found', cleanEmail);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
  if (!isMatch) {
    console.log('Login failed: Password mismatch for', cleanEmail);
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
