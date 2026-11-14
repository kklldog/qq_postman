import { createHmac } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { Config } from './config.js';
import type { MailEventHub } from './event-hub.js';
import type { MailSender } from './mail-sender.js';
import type { IncomingMail, SendMailInput } from './types.js';
import type { MailWatcher } from './mail-watcher.js';

function authorized(request: FastifyRequest, apiKey?: string): boolean {
  if (!apiKey) return true;
  const header = request.headers['x-api-key'];
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  return header === apiKey || bearer === apiKey;
}

function validSendInput(body: unknown): body is SendMailInput {
  if (!body || typeof body !== 'object') return false;
  const input = body as Partial<SendMailInput>;
  const hasBody = typeof input.text === 'string' || typeof input.html === 'string';
  const recipient = typeof input.to === 'string'
    ? input.to.trim().length > 0
    : Array.isArray(input.to) && input.to.length > 0 && input.to.every((item) => typeof item === 'string' && item.trim().length > 0);
  const attachments = input.attachments === undefined || (
    Array.isArray(input.attachments) && input.attachments.every((item) => (
      item && typeof item === 'object' &&
      typeof item.filename === 'string' && item.filename.length > 0 &&
      typeof item.contentBase64 === 'string'
    ))
  );
  return recipient && typeof input.subject === 'string' && hasBody && attachments;
}

function mailEventPayload(mail: IncomingMail): string {
  return `id: ${mail.id}\nevent: mail\ndata: ${JSON.stringify(mail)}\n\n`;
}

export function buildHttpServer(
  config: Config,
  sender: MailSender,
  watcher: MailWatcher,
  hub: MailEventHub,
): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 32 * 1024 * 1024 });
  let externalSubscriberCount = 0;

  app.get('/health', async () => ({
    status: watcher.getStatus().lastError ? 'degraded' : 'ok',
    watcher: watcher.getStatus(),
    subscribers: externalSubscriberCount,
  }));

  app.post('/api/send', async (request, reply) => {
    if (!authorized(request, config.http.apiKey)) return reply.code(401).send({ error: 'unauthorized' });
    if (!validSendInput(request.body)) {
      return reply.code(400).send({ error: 'body must include to, subject, and text or html' });
    }
    try {
      const result = await sender.send(request.body);
      return reply.code(202).send({ ok: true, ...result });
    } catch (error) {
      request.log.error(error, 'SMTP send failed');
      return reply.code(502).send({ error: 'smtp_send_failed' });
    }
  });

  app.get('/api/subscribe', async (request, reply) => {
    if (!authorized(request, config.http.apiKey)) return reply.code(401).send({ error: 'unauthorized' });
    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.write(`retry: 5000\n\n`);

    let closed = false;
    externalSubscriberCount += 1;
    const unsubscribe = hub.subscribe((mail) => {
      if (!closed) response.write(mailEventPayload(mail));
    });
    const heartbeat = setInterval(() => {
      if (!closed) response.write(': heartbeat\n\n');
    }, 15_000);
    await new Promise<void>((resolve) => {
      request.raw.on('close', () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        externalSubscriberCount = Math.max(0, externalSubscriberCount - 1);
        resolve();
      });
    });
  });

  if (config.webhook) {
    hub.subscribe((mail) => {
      void deliverWebhook(config, mail, requestLogger(app));
    });
  }
  return app;
}

function requestLogger(app: FastifyInstance) {
  return (message: string, error?: unknown) => app.log.error(error, message);
}

async function deliverWebhook(
  config: Config,
  mail: IncomingMail,
  log: (message: string, error?: unknown) => void,
): Promise<void> {
  const webhook = config.webhook;
  if (!webhook) return;
  const body = JSON.stringify(mail);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (webhook.secret) headers['x-qq-postman-signature'] = createHmac('sha256', webhook.secret).update(body).digest('hex');

  for (let attempt = 0; attempt <= webhook.retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), webhook.timeoutMs);
    try {
      const response = await fetch(webhook.url, { method: 'POST', headers, body, signal: controller.signal });
      if (response.ok) return;
      throw new Error(`Webhook returned HTTP ${response.status}`);
    } catch (error) {
      if (attempt === webhook.retries) {
        log('Webhook delivery failed', error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(1_000 * 2 ** attempt, 10_000)));
    } finally {
      clearTimeout(timeout);
    }
  }
}
