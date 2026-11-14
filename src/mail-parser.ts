import { randomUUID } from 'node:crypto';
import type { ParsedMail, AddressObject } from 'mailparser';
import { simpleParser } from 'mailparser';
import type { Config } from './config.js';
import type { IncomingMail, MailAddress } from './types.js';

function addresses(value: AddressObject | AddressObject[] | undefined): MailAddress[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((item) =>
    item.value.map((address) => ({
      address: address.address || '',
      ...(address.name ? { name: address.name } : {}),
    })),
  );
}

function headerValueToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(headerValueToString).join(', ');
  if (value && typeof value === 'object' && 'text' in value) {
    return String((value as { text: unknown }).text);
  }
  return String(value ?? '');
}

export async function parseIncomingMail(
  source: Buffer,
  uid: number,
  config: Config,
): Promise<IncomingMail> {
  const parsed: ParsedMail = await simpleParser(source);
  const headers: Record<string, string> = {};
  for (const [key, value] of parsed.headers) headers[key] = headerValueToString(value);

  return {
    id: randomUUID(),
    uid,
    ...(parsed.messageId ? { messageId: parsed.messageId } : {}),
    receivedAt: new Date().toISOString(),
    ...(parsed.date ? { date: parsed.date.toISOString() } : {}),
    from: addresses(parsed.from),
    to: addresses(parsed.to),
    cc: addresses(parsed.cc),
    bcc: addresses(parsed.bcc),
    replyTo: addresses(parsed.replyTo),
    subject: parsed.subject || '',
    text: parsed.text || '',
    ...(typeof parsed.html === 'string' ? { html: parsed.html } : {}),
    headers,
    attachments: parsed.attachments.map((attachment) => ({
      filename: attachment.filename || 'attachment',
      contentType: attachment.contentType,
      size: attachment.size,
      ...(attachment.cid ? { cid: attachment.cid } : {}),
      ...(config.watcher.includeAttachmentContent && attachment.size <= config.watcher.maxAttachmentBytes
        ? { contentBase64: attachment.content.toString('base64') }
        : { truncated: true }),
    })),
  };
}
