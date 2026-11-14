import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from './config.js';
import type { SendMailInput } from './types.js';

export class MailSender {
  private readonly transporter: Transporter;

  constructor(private readonly config: Config) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.account.email, pass: config.account.authCode },
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
