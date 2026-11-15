import { readFileSync, statSync } from 'node:fs';
import type { Config } from './config.js';

export const SERVICE_ID = 'qq-postman';

export interface IndexConfig {
  indexUrl: string;
  baseUrl: string;
  token: string;
}

type Env = Record<string, string | undefined>;

function baseUrlEnv(value: string | undefined, name: string): string {
  if (!value || value.length > 2048 || !/^https?:\/\//i.test(value) || /[\s\\?#\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${name} must be an absolute HTTP(S) base URL without query or fragment`);
  }
  const url = new URL(value);
  if (url.username || url.password) throw new Error(`${name} must not contain credentials`);
  return url.href.replace(/\/$/, '');
}

/** Returns undefined when INDEX_URL is unset or empty, which disables startup registration. */
export function loadIndexConfig(env: Env = process.env): IndexConfig | undefined {
  if (!env.INDEX_URL) return undefined;
  const indexUrl = baseUrlEnv(env.INDEX_URL, 'INDEX_URL');
  const baseUrl = baseUrlEnv(env.PUBLIC_SERVICE_URL, 'PUBLIC_SERVICE_URL');
  const hasToken = Boolean(env.INDEX_API_TOKEN);
  const tokenFile = env.INDEX_API_TOKEN_FILE;
  if (hasToken === Boolean(tokenFile)) {
    throw new Error('Configure exactly one of INDEX_API_TOKEN or INDEX_API_TOKEN_FILE');
  }
  let token = env.INDEX_API_TOKEN ?? '';
  if (tokenFile) {
    const info = statSync(tokenFile);
    if (!info.isFile() || info.size > 4096) throw new Error('INDEX_API_TOKEN_FILE must be a file of at most 4 KiB');
    token = readFileSync(tokenFile, 'utf8').replace(/\r?\n$/, '');
  }
  if (!/^[\x21-\x7e]{1,4096}$/.test(token)) {
    throw new Error('Index token must be nonempty printable ASCII without whitespace');
  }
  return { indexUrl, baseUrl, token };
}

const json = 'application/json';

export function buildRegistration(config: Config, baseUrl: string) {
  const authEnabled = Boolean(config.http.apiKey);
  const unauthorized = authEnabled
    ? [{ status: 401, contentType: json, description: '{"error":"unauthorized"}；缺少或错误的 API Key。' }]
    : [];
  return {
    protocolVersion: '1.0',
    id: SERVICE_ID,
    name: 'QQ Postman',
    description: 'QQ 邮箱桥接服务：通过 QQ 邮箱 SMTP 代发邮件（发件人固定为服务配置的 QQ 邮箱），'
      + `并以 IMAP 轮询（约每 ${Math.round(config.watcher.pollIntervalMs / 1000)} 秒）监听 ${config.imap.mailbox} 新邮件，`
      + '通过 SSE 实时推送给订阅方，可选同时投递到运维配置的 Webhook。按 UID 去重，重启后不重复推送；'
      + '服务不保存邮件历史，只推送订阅期间到达的新邮件。发信会真实发出邮件，有副作用，不能作为健康检查调用。',
    baseUrl,
    authentication: authEnabled
      ? {
          type: 'apiKey',
          headerName: 'x-api-key',
          description: '也可使用 Authorization: Bearer <API Key>；密钥由服务运维提供，不在目录中保存。/health 免鉴权。',
        }
      : { type: 'none' },
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        description: '无副作用的状态检查：返回 status（ok 或 degraded，最近一次 IMAP 检查出错时为 degraded）、'
          + 'watcher（connected、mailbox、lastUid、processedCount、lastError、lastMessageAt）和当前 SSE 订阅数 subscribers。不验证 SMTP 发信能力。',
        authentication: { type: 'none' },
        responses: [{ status: 200, contentType: json, description: '{"status":"ok","watcher":{...},"subscribers":1}。' }],
      },
      {
        method: 'POST',
        path: '/api/send',
        description: '通过 QQ 邮箱 SMTP 立即发送一封邮件，有真实发信副作用；无队列、无幂等键，超时或 502 后不要盲目重发，避免重复邮件。'
          + '请求体上限 32 MiB（含 base64 附件）。',
        request: {
          contentType: json,
          description: '{"to":"a@example.com"|["a@example.com"],"subject":"主题","text":"纯文本","html":"<p>HTML</p>",'
            + '"cc":可选,"bcc":可选,"replyTo":可选,"attachments":[{"filename":"a.txt","contentBase64":"SGVsbG8=","contentType":"text/plain"}]}。'
            + 'to、subject 必填，text 与 html 至少一个；cc/bcc 可为字符串或数组。',
        },
        responses: [
          { status: 202, contentType: json, description: '{"ok":true,"messageId":"...","accepted":[...],"rejected":[...]}；表示 SMTP 服务器已接受，不代表最终投递成功。' },
          { status: 400, contentType: json, description: '请求体无效或缺少 to、subject、text/html。' },
          ...unauthorized,
          { status: 413, contentType: json, description: '请求体超过 32 MiB。' },
          { status: 415, contentType: json, description: 'Content-Type 不是 application/json。' },
          { status: 502, contentType: json, description: '{"error":"smtp_send_failed"}；SMTP 发信失败。' },
        ],
      },
      {
        method: 'GET',
        path: '/api/subscribe',
        description: 'SSE 长连接订阅新邮件，只推送连接期间到达的邮件，不回放历史。每封邮件一个 event: mail，'
          + 'data 为 JSON：id、uid、messageId、receivedAt、date、from/to/cc/bcc/replyTo（[{address,name}]）、subject、text、html、headers、'
          + 'attachments（filename、contentType、size、可选 contentBase64/truncated/cid）。每 15 秒发送注释心跳，'
          + '首帧 retry: 5000，断线后客户端应自动重连；断线期间的邮件不会补发。',
        responses: [
          { status: 200, contentType: 'text/event-stream', description: '持续的 SSE 事件流。' },
          ...unauthorized,
        ],
      },
    ],
  };
}

export async function registerService(
  index: IndexConfig,
  registration: { id: string },
  { timeoutMs = 5000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ outcome: string }> {
  const url = new URL(index.indexUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/api/v1/services/${encodeURIComponent(registration.id)}`;
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${index.token}` },
    body: JSON.stringify(registration),
    redirect: 'error',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  let result: any;
  try {
    result = await response.json();
  } catch (cause) {
    throw new Error(`Index returned non-JSON data (HTTP ${response.status})`, { cause });
  }
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Index registration failed (HTTP ${response.status}, ${result?.error?.code ?? 'UNKNOWN_ERROR'})`);
  }
  const allowed = response.status === 201 ? ['created'] : ['updated', 'unchanged'];
  if (!allowed.includes(result?.outcome)
    || result.service?.registration?.id !== registration.id
    || result.service?.verification !== 'self-reported') {
    throw new Error('Index returned an invalid registration acknowledgement');
  }
  return { outcome: result.outcome };
}

/** Registers with limited exponential backoff; rejects after the final attempt fails or when aborted. */
export async function registerWithRetry(
  index: IndexConfig,
  registration: { id: string },
  { attempts = 5, signal, onRetry }: {
    attempts?: number;
    signal?: AbortSignal;
    onRetry?: (error: unknown, attempt: number) => void;
  } = {},
): Promise<{ outcome: string }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await registerService(index, registration, { signal });
    } catch (error) {
      if (attempt >= attempts || signal?.aborted) throw error;
      onRetry?.(error, attempt);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, Math.min(2_000 * 2 ** (attempt - 1), 30_000));
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        }, { once: true });
      });
    }
  }
}
