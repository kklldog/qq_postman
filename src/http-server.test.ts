import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildHttpServer } from './http-server.js';
import type { Config } from './config.js';
import { MailEventHub } from './event-hub.js';
import type { MailSender } from './mail-sender.js';
import type { MailWatcher } from './mail-watcher.js';

const config: Config = {
  http: { host: '127.0.0.1', port: 3000 },
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
