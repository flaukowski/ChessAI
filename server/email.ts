import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const fromEmail = process.env.FROM_EMAIL || 'noreply@audionoise.app';

export const sendVerificationEmail = async (to: string, token: string, firstName?: string) => {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  const name = firstName || 'there';

  await transporter.sendMail({
    from: `"AudioNoise" <${fromEmail}>`,
    to,
    subject: 'Verify your AudioNoise account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #0a0118; color: #fff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22d3ee; margin: 0;">AudioNoise</h1>
          <p style="color: #9ca3af; margin-top: 5px;">Real-time audio processing</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 30px; border: 1px solid rgba(255,255,255,0.1);">
          <h2 style="margin-top: 0; color: #fff;">Hey ${name}!</h2>
          <p style="color: #d1d5db; line-height: 1.6;">
            Thanks for signing up for AudioNoise. Please verify your email address to complete your registration.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(to right, #0891b2, #9333ea); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 14px;">
            Or copy this link: <a href="${verifyUrl}" style="color: #22d3ee;">${verifyUrl}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This link expires in 24 hours. If you didn't create an account, you can ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px;">
          <p>Powered by Space Child Auth with ZKP</p>
        </div>
      </div>
    `,
    text: `Hey ${name}! Verify your AudioNoise account by visiting: ${verifyUrl}`,
  });
};

export const sendPasswordResetEmail = async (to: string, token: string) => {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"AudioNoise" <${fromEmail}>`,
    to,
    subject: 'Reset your AudioNoise password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #0a0118; color: #fff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22d3ee; margin: 0;">AudioNoise</h1>
          <p style="color: #9ca3af; margin-top: 5px;">Password Reset</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 30px; border: 1px solid rgba(255,255,255,0.1);">
          <h2 style="margin-top: 0; color: #fff;">Reset Your Password</h2>
          <p style="color: #d1d5db; line-height: 1.6;">
            You requested to reset your password. Click the button below to create a new password.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; padding: 14px 32px; background: linear-gradient(to right, #0891b2, #9333ea); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 14px;">
            Or copy this link: <a href="${resetUrl}" style="color: #22d3ee;">${resetUrl}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px;">
          <p>Powered by Space Child Auth with ZKP</p>
        </div>
      </div>
    `,
    text: `Reset your AudioNoise password by visiting: ${resetUrl}`,
  });
};

export const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('[Email] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[Email] SMTP connection failed:', error);
    return false;
  }
};
