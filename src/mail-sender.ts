import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from './config.js';
import type { SendMailInput } from './types.js';

export class MailSender {
  private transporter: Transporter;

  constructor(private readonly config: Config) {
    this.transporter = this.createTransport();
  }

  updateCredentials(email: string, authCode: string): void {
    this.transporter.close();
    this.config.account.email = email;
    this.config.account.authCode = authCode;
    this.transporter = this.createTransport();
  }

  private createTransport(): Transporter {
    return nodemailer.createTransport({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: { user: this.config.account.email, pass: this.config.account.authCode },
    });
  }

  async send(input: SendMailInput): Promise<{ messageId?: string; accepted: string[]; rejected: string[] }> {
    const result = await this.transporter.sendMail({
      from: this.config.account.email,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.contentBase64, 'base64'),
        contentType: attachment.contentType,
      })),
    });
    return {
      ...(result.messageId ? { messageId: result.messageId } : {}),
      accepted: result.accepted.map(String),
      rejected: result.rejected.map(String),
    };
  }
}
