import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadIndexConfig, registerService, registerWithRetry } from './registry.js';

const token = 'x'.repeat(32);
const index = (indexUrl: string) => ({ indexUrl, baseUrl: 'http://svc.example.test:3000', token });

async function withIndex(
  handler: (body: any, headers: IncomingHttpHeaders) => { status: number; body: unknown },
  run: (url: string, calls: Array<{ method?: string; url?: string }>) => Promise<void>,
) {
  const calls: Array<{ method?: string; url?: string }> = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url });
      const { status, body } = handler(JSON.parse(raw), req.headers);
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`, calls);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const ack = (registration: any, outcome: string) => ({
  outcome,
  service: { registration, verification: 'self-reported' },
});

describe('loadIndexConfig', () => {
  it('is disabled without INDEX_URL', () => {
    expect(loadIndexConfig({ INDEX_API_TOKEN_FILE: 'never-read' })).toBeUndefined();
  });

  it('requires exactly one token source', () => {
    const env = { INDEX_URL: 'http://index.test', PUBLIC_SERVICE_URL: 'http://svc.test' };
    expect(() => loadIndexConfig(env)).toThrow(/exactly one/);
    expect(() => loadIndexConfig({ ...env, INDEX_API_TOKEN: token, INDEX_API_TOKEN_FILE: 'f' })).toThrow(/exactly one/);
  });

  it('reads the token file and normalizes the public base URL', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-postman-'));
    try {
      const file = join(dir, 'token');
      writeFileSync(file, `${token}\r\n`);
      expect(loadIndexConfig({
        INDEX_URL: 'http://index.test:8790',
        PUBLIC_SERVICE_URL: 'http://svc.test:3000/',
        INDEX_API_TOKEN_FILE: file,
      })).toEqual({ indexUrl: 'http://index.test:8790', baseUrl: 'http://svc.test:3000', token });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects public URLs with credentials or query strings', () => {
    const env = { INDEX_URL: 'http://index.test', INDEX_API_TOKEN: token };
    expect(() => loadIndexConfig({ ...env, PUBLIC_SERVICE_URL: 'http://u:p@svc.test' })).toThrow(/credentials/);
    expect(() => loadIndexConfig({ ...env, PUBLIC_SERVICE_URL: 'http://svc.test/?a=1' })).toThrow(/PUBLIC_SERVICE_URL/);
  });
});

describe('registerService', () => {
  it('PUTs the registration with the bearer token and validates the acknowledgement', async () => {
    let received: any;
    await withIndex((body, headers) => {
      received = { body, auth: headers.authorization };
      return { status: 201, body: ack(body, 'created') };
    }, async (url, calls) => {
      await expect(registerService(index(url), { id: 'qq-postman' })).resolves.toEqual({ outcome: 'created' });
      expect(calls).toEqual([{ method: 'PUT', url: '/api/v1/services/qq-postman' }]);
      expect(received).toEqual({ body: { id: 'qq-postman' }, auth: `Bearer ${token}` });
    });
  });

  it('rejects error responses and mismatched acknowledgements', async () => {
    await withIndex(() => ({ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }), async (url) => {
      await expect(registerService(index(url), { id: 'qq-postman' })).rejects.toThrow(/401, UNAUTHORIZED/);
    });
    await withIndex((body) => ({ status: 200, body: ack({ ...body, id: 'other' }, 'updated') }), async (url) => {
      await expect(registerService(index(url), { id: 'qq-postman' })).rejects.toThrow(/invalid registration/);
    });
  });
});

describe('registerWithRetry', () => {
  it('stops after the configured number of attempts', async () => {
    await withIndex(() => ({ status: 500, body: { error: { code: 'STORAGE_ERROR' } } }), async (url, calls) => {
      const retries: number[] = [];
      await expect(registerWithRetry(index(url), { id: 'qq-postman' }, {
        attempts: 2,
        onRetry: (_error, attempt) => retries.push(attempt),
      })).rejects.toThrow(/STORAGE_ERROR/);
      expect(calls).toHaveLength(2);
      expect(retries).toEqual([1]);
    });
  }, 10_000);
});
