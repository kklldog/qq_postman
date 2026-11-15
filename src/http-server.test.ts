import { afterEach, describe, expect, it, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { buildHttpServer } from './http-server.js';
import type { Config } from './config.js';
import { MailEventHub } from './event-hub.js';
import type { MailSender } from './mail-sender.js';
import type { MailWatcher } from './mail-watcher.js';

const config: Config = {
  http: { host: '127.0.0.1', port: 3000 },
  accountFile: 'data/mail-account.json',
  account: { email: 'sender@example.com', authCode: 'unused' },
  smtp: { host: 'localhost', port: 465, secure: true },
  imap: { host: 'localhost', port: 993, secure: true, mailbox: 'INBOX' },
  watcher: {
    pollIntervalMs: 30_000,
    initialSync: false,
    stateFile: 'state.json',
    includeAttachmentContent: false,
    maxAttachmentBytes: 0,
  },
};

describe('POST /api/send body limit', () => {
  afterEach(() => vi.restoreAllMocks());

  it('accepts a JSON attachment request larger than 1 MiB', async () => {
    const send = vi.fn().mockResolvedValue({ accepted: ['reader@example.com'], rejected: [] });
    const watcher = { getStatus: () => ({ connected: true, mailbox: 'INBOX', lastUid: 0, processedCount: 0 }) };
    const app = buildHttpServer(config, { send } as unknown as MailSender,
      watcher as unknown as MailWatcher, new MailEventHub());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/send',
        payload: {
          to: 'reader@example.com',
          subject: 'preview',
          text: 'images attached',
          attachments: [{ filename: 'preview.png', contentBase64: 'A'.repeat(1_400_000), contentType: 'image/png' }],
        },
      });

      expect(response.statusCode).toBe(202);
      expect(send).toHaveBeenCalledOnce();
      expect(send.mock.calls[0]?.[0].attachments?.[0]?.contentBase64).toHaveLength(1_400_000);
    } finally {
      await app.close();
    }
  });

  it('rejects requests larger than 32 MiB before sending', async () => {
    const send = vi.fn();
    const watcher = { getStatus: () => ({ connected: true, mailbox: 'INBOX', lastUid: 0, processedCount: 0 }) };
    const app = buildHttpServer(config, { send } as unknown as MailSender,
      watcher as unknown as MailWatcher, new MailEventHub());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/send',
        headers: { 'content-type': 'application/json' },
        payload: `{"to":"reader@example.com","subject":"preview","text":"${'x'.repeat(33 * 1024 * 1024)}"}`,
      });

      expect(response.statusCode).toBe(413);
      expect(send).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

describe('web settings', () => {
  it('does not expose the authorization code and restarts with saved credentials', async () => {
    const send = vi.fn();
    const updateCredentials = vi.fn();
    const stop = vi.fn().mockResolvedValue(undefined);
    const start = vi.fn().mockResolvedValue(undefined);
    const watcher = {
      getStatus: () => ({ connected: true, mailbox: 'INBOX', lastUid: 12, processedCount: 3 }),
      stop,
      start,
    };
    const accountFile = 'data/test-mail-account.json';
    const runtimeConfig = { ...config, account: { ...config.account }, accountFile };
    updateCredentials.mockImplementation((email: string, authCode: string) => {
      runtimeConfig.account.email = email;
      runtimeConfig.account.authCode = authCode;
    });
    const app = buildHttpServer(
      runtimeConfig,
      { send, updateCredentials } as unknown as MailSender,
      watcher as unknown as MailWatcher,
      new MailEventHub(),
    );

    try {
      const update = await app.inject({
        method: 'PUT',
        url: '/api/settings',
        payload: { email: 'new@example.com', authCode: 'new-secret' },
      });
      expect(update.statusCode).toBe(200);
      expect(update.json()).toMatchObject({ email: 'new@example.com', hasAuthCode: true, configured: true });
      expect(update.body).not.toContain('new-secret');
      expect(updateCredentials).toHaveBeenCalledWith('new@example.com', 'new-secret');
      expect(stop).toHaveBeenCalledOnce();
      expect(start).toHaveBeenCalledOnce();

      const settings = await app.inject({ method: 'GET', url: '/api/settings' });
      expect(settings.statusCode).toBe(200);
      expect(settings.body).not.toContain('new-secret');
    } finally {
      await app.close();
      await rm(accountFile, { force: true });
      config.account.email = 'sender@example.com';
      config.account.authCode = 'unused';
    }
  });

  it('requires a new authorization code when changing email', async () => {
    const app = buildHttpServer(
      config,
      { send: vi.fn(), updateCredentials: vi.fn() } as unknown as MailSender,
      { getStatus: () => ({ connected: true, mailbox: 'INBOX', lastUid: 0, processedCount: 0 }) } as unknown as MailWatcher,
      new MailEventHub(),
    );
    try {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/settings',
        payload: { email: 'different@example.com', authCode: '' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('auth_code_required');
    } finally {
      await app.close();
    }
  });
});
