import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';

function numberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  throw new Error(`${name} must be true or false`);
}

export interface Config {
  http: { host: string; port: number; apiKey?: string };
  adminApiKey?: string;
  account: { email: string; authCode: string };
  accountFile: string;
  smtp: { host: string; port: number; secure: boolean };
  imap: { host: string; port: number; secure: boolean; mailbox: string };
  watcher: {
    pollIntervalMs: number;
    initialSync: boolean;
    stateFile: string;
    includeAttachmentContent: boolean;
    maxAttachmentBytes: number;
  };
  webhook?: {
    url: string;
    secret?: string;
    timeoutMs: number;
    retries: number;
  };
}

export function loadConfig(): Config {
  const accountFile = process.env.ACCOUNT_CONFIG_FILE?.trim() || 'data/mail-account.json';
  const persistedAccount = readPersistedAccount(accountFile);
  const email = persistedAccount?.email || process.env.QQ_EMAIL?.trim();
  const authCode = persistedAccount?.authCode || process.env.SMTP_AUTHCODE?.trim();
  if (!email || !authCode) {
    throw new Error('Missing QQ account configuration. Set QQ_EMAIL and SMTP_AUTHCODE or configure it in the web page.');
  }
  const webhookUrl = process.env.WEBHOOK_URL?.trim();
  const webhook = webhookUrl
    ? {
        url: webhookUrl,
        secret: process.env.WEBHOOK_SECRET?.trim() || undefined,
        timeoutMs: numberEnv('WEBHOOK_TIMEOUT_MS', 10_000),
        retries: Math.max(0, Math.floor(numberEnv('WEBHOOK_RETRIES', 3))),
      }
    : undefined;

  return {
    http: {
      host: process.env.HOST?.trim() || '0.0.0.0',
      port: numberEnv('PORT', 3000),
      apiKey: process.env.API_KEY?.trim() || undefined,
    },
    adminApiKey: process.env.ADMIN_API_KEY?.trim() || process.env.API_KEY?.trim() || undefined,
    account: { email, authCode },
    accountFile,
    smtp: {
      host: process.env.SMTP_HOST?.trim() || 'smtp.qq.com',
      port: numberEnv('SMTP_PORT', 465),
      secure: booleanEnv('SMTP_SECURE', true),
    },
    imap: {
      host: process.env.IMAP_HOST?.trim() || 'imap.qq.com',
      port: numberEnv('IMAP_PORT', 993),
      secure: booleanEnv('IMAP_SECURE', true),
      mailbox: process.env.MAILBOX?.trim() || 'INBOX',
    },
    watcher: {
      pollIntervalMs: Math.max(1_000, numberEnv('MAIL_POLL_INTERVAL_MS', 30_000)),
      initialSync: booleanEnv('MAIL_INITIAL_SYNC', false),
      stateFile: process.env.STATE_FILE?.trim() || 'data/mail-state.json',
      includeAttachmentContent: booleanEnv('INCLUDE_ATTACHMENT_CONTENT', true),
      maxAttachmentBytes: Math.max(0, numberEnv('MAX_ATTACHMENT_BYTES', 10 * 1024 * 1024)),
    },
    webhook,
  };
}

function readPersistedAccount(file: string): { email: string; authCode: string } | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')) as Partial<{ email: string; authCode: string }>;
    if (typeof value.email !== 'string' || typeof value.authCode !== 'string') return undefined;
    if (!value.email.trim() || !value.authCode.trim()) return undefined;
    return { email: value.email.trim(), authCode: value.authCode.trim() };
  } catch (error) {
    console.error('Could not read persisted QQ account configuration:', error);
    return undefined;
  }
}
