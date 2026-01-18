import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { authenticateToken } from './auth';
import { insertSupportTicketSchema } from '@shared/schema';
import nodemailer from 'nodemailer';

const router = Router();

// Support email configuration
const SUPPORT_EMAIL = 'nick@spacechild.love';

// Create email transporter (using environment variables)
const createTransporter = () => {
  // For development, use ethereal or console logging
  if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Send support email
async function sendSupportEmail(ticket: {
  email: string;
  name?: string | null;
  subject: string;
  message: string;
  ticketId: string;
}): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('[Support] Email transporter not configured. Ticket details:');
    console.log(`  From: ${ticket.name || 'Anonymous'} <${ticket.email}>`);
    console.log(`  Subject: ${ticket.subject}`);
    console.log(`  Message: ${ticket.message}`);
    console.log(`  Ticket ID: ${ticket.ticketId}`);
    return true; // Consider it successful in development
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@audionoise.app',
      to: SUPPORT_EMAIL,
      replyTo: ticket.email,
      subject: `[AudioNoise Support] ${ticket.subject}`,
      text: `
Support Request from AudioNoise Web

From: ${ticket.name || 'Anonymous'} <${ticket.email}>
Ticket ID: ${ticket.ticketId}

Message:
${ticket.message}

---
Reply directly to this email to respond to the user.
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 16px; }
    .message { background: white; padding: 16px; border-radius: 4px; border-left: 4px solid #06b6d4; }
    .footer { margin-top: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">Support Request</h2>
      <p style="margin:8px 0 0 0;opacity:0.9;">AudioNoise Web</p>
    </div>
    <div class="content">
      <div class="meta">
        <strong>From:</strong> ${ticket.name || 'Anonymous'} &lt;${ticket.email}&gt;<br>
        <strong>Ticket ID:</strong> ${ticket.ticketId}
      </div>
      <div class="message">
        ${ticket.message.replace(/\n/g, '<br>')}
      </div>
      <div class="footer">
        Reply directly to this email to respond to the user.
      </div>
    </div>
  </div>
</body>
</html>
      `,
    });

    console.log(`[Support] Email sent for ticket ${ticket.ticketId}`);
    return true;
  } catch (error) {
    console.error('[Support] Failed to send email:', error);
    return false;
  }
}

// Submit support request (public - no auth required)
router.post('/contact', async (req: Request, res: Response) => {
  try {
    const validation = insertSupportTicketSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    // Create support ticket
    const ticket = await storage.createSupportTicket(validation.data);

    // Send email notification
    const emailSent = await sendSupportEmail({
      email: validation.data.email,
      name: validation.data.name,
      subject: validation.data.subject,
      message: validation.data.message,
      ticketId: ticket.id,
    });

    res.status(201).json({
      success: true,
      ticketId: ticket.id,
      message: 'Your message has been sent. We\'ll get back to you soon!',
      emailSent,
    });
  } catch (error) {
    console.error('Support contact error:', error);
    res.status(500).json({ error: 'Failed to submit support request' });
  }
});

// Submit support request (authenticated user)
router.post('/contact/auth', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const validation = insertSupportTicketSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    // Create support ticket with user ID
    const ticket = await storage.createSupportTicket(validation.data, userId);

    // Send email notification
    const emailSent = await sendSupportEmail({
      email: validation.data.email,
      name: validation.data.name,
      subject: validation.data.subject,
      message: validation.data.message,
      ticketId: ticket.id,
    });

    res.status(201).json({
      success: true,
      ticketId: ticket.id,
      message: 'Your message has been sent. We\'ll get back to you soon!',
      emailSent,
    });
  } catch (error) {
    console.error('Support contact error:', error);
    res.status(500).json({ error: 'Failed to submit support request' });
  }
});

// Get user's support tickets (authenticated)
router.get('/tickets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const tickets = await storage.getUserSupportTickets(userId);
    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

export default router;
