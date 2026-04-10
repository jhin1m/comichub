import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly appName: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.host', '');
    const port = this.configService.get<number>('mail.port', 465);
    const user = this.configService.get<string>('mail.user', '');
    const pass = this.configService.get<string>('mail.pass', '');
    this.from = this.configService.get<string>('mail.from', 'noreply@comichub.com');
    // Escape HTML entities to prevent injection in email templates
    const rawName = this.configService.get<string>('app.name', 'ComicHub');
    this.appName = rawName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP not configured — emails will not be sent');
    }
  }

  async sendResetPassword(to: string, resetUrl: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`Reset email skipped (no SMTP): ${to}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Reset your ${this.appName} password`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#e74c3c">${this.appName} Password Reset</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 24px;background:#e74c3c;color:#fff;
                    text-decoration:none;border-radius:6px;font-weight:bold">
            Reset Password
          </a>
          <p style="margin-top:16px;color:#888;font-size:13px">
            This link expires in 15 minutes. If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });
  }
}
