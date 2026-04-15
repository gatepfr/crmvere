import nodemailer from 'nodemailer';

export const sendResetPasswordEmail = async (email: string, token: string) => {
  // Create a transporter using your email service settings
  // This uses Ethereal for testing or real SMTP if configured in .env
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"CRM do Verê" <${process.env.SMTP_FROM || 'noreply@crmvere.com.br'}>`,
    to: email,
    subject: 'Redefinição de Senha - CRM do Verê',
    html: `
      <h1>Redefinição de Senha</h1>
      <p>Você solicitou a redefinição de senha para sua conta no CRM do Verê.</p>
      <p>Clique no link abaixo para criar uma nova senha:</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Redefinir Senha</a>
      <p>Este link expira em 1 hora.</p>
      <p>Se você não solicitou esta mudança, por favor ignore este e-mail.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Link de redefinição enviado para: ${email}`);
  } catch (error: any) {
    console.error(`[EMAIL] ❌ Erro ao enviar e-mail para ${email}:`, error.message);
    throw new Error('Falha no serviço de e-mail');
  }
};
