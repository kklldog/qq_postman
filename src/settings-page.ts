export const settingsPage: string = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QQ Postman 设置</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --panel: #ffffff;
      --ink: #162338;
      --muted: #64748b;
      --line: #dbe3ef;
      --accent: #2563eb;
      --accent-dark: #1d4ed8;
      --ok: #087443;
      --ok-bg: #e8f7ef;
      --warn: #9a6700;
      --warn-bg: #fff7df;
      --bad: #b42318;
      --bad-bg: #fff0ee;
      --shadow: 0 18px 48px rgba(30, 53, 87, .10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 320px;
      background: var(--bg);
      color: var(--ink);
      font: 15px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    }
    .shell { width: min(980px, calc(100% - 32px)); margin: 32px auto 48px; }
    .hero { margin-bottom: 20px; }
    .eyebrow { margin: 0 0 5px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
    h1, h2, p { margin-top: 0; }
    h1 { margin-bottom: 6px; font-size: clamp(25px, 5vw, 36px); line-height: 1.2; letter-spacing: 0; }
    .lede { max-width: 680px; margin-bottom: 0; color: var(--muted); }
    .panel { margin-top: 18px; padding: 24px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); box-shadow: var(--shadow); }
    .panel h2 { margin-bottom: 4px; font-size: 19px; }
    .panel-intro { margin-bottom: 20px; color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 7px; }
    .field.wide { grid-column: 1 / -1; }
    label { font-weight: 650; }
    .hint { margin: -1px 0 0; color: var(--muted); font-size: 12px; }
    input {
      width: 100%; min-height: 43px; padding: 9px 12px; border: 1px solid #bfccdc; border-radius: 7px;
      background: #fff; color: var(--ink); font: inherit; outline: none; transition: border-color .15s, box-shadow .15s;
    }
    input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, .14); }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 21px; }
    button {
      min-height: 41px; padding: 8px 15px; border: 1px solid transparent; border-radius: 7px; cursor: pointer;
      font: inherit; font-weight: 650; transition: background .15s, border-color .15s, opacity .15s;
    }
    button:disabled { cursor: wait; opacity: .58; }
    .primary { background: var(--accent); color: #fff; }
    .primary:hover:not(:disabled) { background: var(--accent-dark); }
    .secondary { border-color: #bfccdc; background: #fff; color: var(--ink); }
    .secondary:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-dark); }
    .status-line { min-height: 24px; margin: 14px 0 0; color: var(--muted); font-size: 13px; }
    .notice { display: none; margin: 18px 0 0; padding: 11px 13px; border-radius: 7px; }
    .notice.show { display: block; }
    .notice.ok { color: var(--ok); background: var(--ok-bg); }
    .notice.warn { color: var(--warn); background: var(--warn-bg); }
    .notice.error { color: var(--bad); background: var(--bad-bg); }
    .status-head { display: flex; justify-content: space-between; gap: 14px; align-items: end; margin-bottom: 17px; }
    .status-head h2 { margin-bottom: 0; }
    .updated { color: var(--muted); font-size: 12px; text-align: right; }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 11px; }
    .card { min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fbfcfe; }
    .card-label { display: block; margin-bottom: 3px; color: var(--muted); font-size: 12px; }
    .card-value { display: block; overflow-wrap: anywhere; font-size: 15px; font-weight: 700; }
    .card-value.good { color: var(--ok); }
    .card-value.bad { color: var(--bad); }
    .card-value.muted { color: var(--muted); font-weight: 500; }
    @media (max-width: 720px) {
      .shell { width: min(100% - 22px, 620px); margin-top: 22px; }
      .panel { padding: 18px; }
      .grid, .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .status-head { align-items: start; flex-direction: column; gap: 4px; }
      .updated { text-align: left; }
    }
    @media (max-width: 430px) {
      .grid, .cards { grid-template-columns: 1fr; }
      .field.wide { grid-column: auto; }
      button { width: 100%; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">QQ Postman</p>
      <h1>邮箱监听设置</h1>
      <p class="lede">配置 QQ 邮箱授权码后，服务会通过 IMAP 监听新邮件，并把邮件推送给订阅方。</p>
    </header>

    <section class="panel" aria-labelledby="settings-title">
      <h2 id="settings-title">账号配置</h2>
      <p class="panel-intro">授权码只用于当前请求和服务端配置，不会从接口回填到页面。</p>
      <form id="settings-form" novalidate>
        <div class="grid">
          <div class="field wide">
            <label for="email">QQ 邮箱</label>
            <input id="email" name="email" type="email" autocomplete="email" placeholder="例如：name@qq.com" required>
            <p class="hint">切换邮箱时必须填写新邮箱对应的授权码。</p>
          </div>
          <div class="field">
            <label for="authCode">SMTP_AUTHCODE 授权码</label>
            <input id="authCode" name="authCode" type="password" autocomplete="new-password" placeholder="留空则保留当前授权码">
            <p class="hint">授权码不会显示在状态接口或页面中。</p>
          </div>
          <div class="field">
            <label for="apiKey">API Key（可选）</label>
            <input id="apiKey" name="apiKey" type="password" autocomplete="off" placeholder="服务启用 API_KEY 时填写">
            <p class="hint">只保存在当前页面内存，刷新页面后需要重新填写。</p>
          </div>
        </div>
        <div class="actions">
          <button id="load-button" class="secondary" type="button">加载配置</button>
          <button id="save-button" class="primary" type="submit">保存并重新监听</button>
          <button id="restart-button" class="secondary" type="button">重新监听</button>
        </div>
        <p id="status-line" class="status-line" role="status" aria-live="polite"></p>
        <div id="notice" class="notice" role="alert" aria-live="assertive"></div>
      </form>
    </section>

    <section class="panel" aria-labelledby="watcher-title">
      <div class="status-head">
        <h2 id="watcher-title">监听状态</h2>
        <span id="updated" class="updated">尚未读取</span>
      </div>
      <div class="cards">
        <div class="card"><span class="card-label">账号</span><span id="account-value" class="card-value">未读取</span></div>
        <div class="card"><span class="card-label">授权码</span><span id="auth-value" class="card-value">未读取</span></div>
        <div class="card"><span class="card-label">配置状态</span><span id="configured-value" class="card-value">未读取</span></div>
        <div class="card"><span class="card-label">IMAP 连接</span><span id="imap-value" class="card-value">未读取</span></div>
        <div class="card"><span class="card-label">邮箱文件夹</span><span id="mailbox-value" class="card-value">未读取</span></div>
        <div class="card"><span class="card-label">最后 UID</span><span id="uid-value" class="card-value">未读取</span></div>
        <div class="card"><span class="card-label">已处理邮件</span><span id="processed-value" class="card-value">未读取</span></div>
        <div class="card"><span class="card-label">最后一封邮件</span><span id="message-value" class="card-value">未读取</span></div>
        <div class="card" style="grid-column: 1 / -1"><span class="card-label">最后错误</span><span id="error-value" class="card-value muted">无</span></div>
      </div>
    </section>
  </main>
  <script>
    (() => {
      'use strict';
      let apiKey = '';
      let requestBusy = false;
      let emailDirty = false;
      let currentEmail = '';
      let hasLoaded = false;
      const el = {
        form: document.getElementById('settings-form'),
        email: document.getElementById('email'),
        authCode: document.getElementById('authCode'),
        apiKey: document.getElementById('apiKey'),
        load: document.getElementById('load-button'),
        save: document.getElementById('save-button'),
        restart: document.getElementById('restart-button'),
        line: document.getElementById('status-line'),
        notice: document.getElementById('notice'),
        updated: document.getElementById('updated'),
        account: document.getElementById('account-value'),
        auth: document.getElementById('auth-value'),
        configured: document.getElementById('configured-value'),
        imap: document.getElementById('imap-value'),
        mailbox: document.getElementById('mailbox-value'),
        uid: document.getElementById('uid-value'),
        processed: document.getElementById('processed-value'),
        message: document.getElementById('message-value'),
        error: document.getElementById('error-value')
      };

      function showNotice(message, kind) {
        el.notice.textContent = message || '';
        el.notice.className = message ? 'notice show ' + kind : 'notice';
      }

      function setLine(message) { el.line.textContent = message || ''; }

      function setBusy(busy, label) {
        requestBusy = busy;
        el.load.disabled = busy;
        el.save.disabled = busy;
        el.restart.disabled = busy;
        setLine(busy ? label : '');
      }

      function request(path, options) {
        const init = options || {};
        const headers = new Headers(init.headers || {});
        if (apiKey) headers.set('x-api-key', apiKey);
        if (init.body !== undefined) headers.set('content-type', 'application/json');
        return fetch(path, Object.assign({}, init, { headers: headers }));
      }

      async function readResponse(response) {
        let body = {};
        try { body = await response.json(); } catch (_) { body = {}; }
        if (!response.ok) {
          const error = body && typeof body.error === 'string' ? body.error : 'request_failed';
          const message = body && typeof body.message === 'string' ? body.message : error;
          const failure = new Error(message);
          failure.code = error;
          failure.status = response.status;
          throw failure;
        }
        return body;
      }

      function text(value, fallback) {
        return value === undefined || value === null || value === '' ? fallback : String(value);
      }

      function setValue(node, value, className) {
        node.textContent = value;
        node.className = 'card-value' + (className ? ' ' + className : '');
      }

      function render(settings, applyEmail) {
        const watcher = settings && settings.watcher && typeof settings.watcher === 'object' ? settings.watcher : {};
        const email = typeof settings.email === 'string' ? settings.email : '';
        if (applyEmail && !emailDirty) el.email.value = email;
        if (email) currentEmail = email;
        setValue(el.account, text(email, '未配置'), email ? '' : 'muted');
        setValue(el.auth, settings.hasAuthCode ? '已配置' : '未配置', settings.hasAuthCode ? 'good' : 'bad');
        setValue(el.configured, settings.configured ? '已完成' : '未完成', settings.configured ? 'good' : 'bad');
        setValue(el.imap, watcher.connected ? '已连接' : '未连接', watcher.connected ? 'good' : 'bad');
        setValue(el.mailbox, text(watcher.mailbox, '未读取'), '');
        setValue(el.uid, text(watcher.lastUid, '0'), '');
        setValue(el.processed, text(watcher.processedCount, '0'), '');
        setValue(el.message, text(watcher.lastMessageAt, '暂无'), watcher.lastMessageAt ? '' : 'muted');
        setValue(el.error, text(watcher.lastError, '无'), watcher.lastError ? 'bad' : 'muted');
        el.updated.textContent = '最近刷新：' + new Date().toLocaleTimeString();
        hasLoaded = true;
      }

      function handleFailure(error, silent) {
        if (error && error.status === 401) {
          showNotice('服务需要 API Key，请填写后点击“加载配置”。', 'warn');
          if (!silent) el.apiKey.focus();
          return;
        }
        if (!silent) showNotice('请求失败：' + (error && error.message ? error.message : '网络异常'), 'error');
      }

      async function loadSettings(manual) {
        if (requestBusy && manual) return;
        if (manual) setBusy(true, '正在加载配置…');
        try {
          const settings = await readResponse(await request('/api/settings'));
          render(settings, true);
          if (manual) showNotice('配置已加载。', 'ok');
        } catch (error) {
          handleFailure(error, !manual);
        } finally {
          if (manual) setBusy(false, '');
        }
      }

      async function saveSettings(event) {
        event.preventDefault();
        if (requestBusy) return;
        const email = el.email.value.trim();
        const authCode = el.authCode.value;
        if (!email) { showNotice('请填写 QQ 邮箱。', 'error'); el.email.focus(); return; }
        if (email !== currentEmail && !authCode.trim()) {
          showNotice('切换邮箱时必须填写新邮箱的授权码。', 'error');
          el.authCode.focus();
          return;
        }
        setBusy(true, '正在保存并重新监听…');
        try {
          const settings = await readResponse(await request('/api/settings', {
            method: 'PUT',
            body: JSON.stringify({ email: email, authCode: authCode })
          }));
          emailDirty = false;
          currentEmail = typeof settings.email === 'string' ? settings.email : email;
          el.authCode.value = '';
          render(settings, true);
          showNotice('配置已保存，监听已重新启动。', 'ok');
        } catch (error) {
          handleFailure(error, false);
        } finally {
          setBusy(false, '');
        }
      }

      async function restartWatcher() {
        if (requestBusy) return;
        setBusy(true, '正在重新启动监听…');
        try {
          const settings = await readResponse(await request('/api/settings/restart', { method: 'POST' }));
          render(settings, false);
          showNotice('监听已重新启动。', 'ok');
        } catch (error) {
          handleFailure(error, false);
        } finally {
          setBusy(false, '');
        }
      }

      el.email.addEventListener('input', () => { emailDirty = true; });
      el.form.addEventListener('submit', saveSettings);
      el.load.addEventListener('click', () => {
        apiKey = el.apiKey.value.trim();
        void loadSettings(true);
      });
      el.restart.addEventListener('click', () => { void restartWatcher(); });
      void loadSettings(false);
      window.setInterval(() => {
        if (!document.hidden && !requestBusy) void loadSettings(false);
      }, 5000);
    })();
  </script>
</body>
</html>`;
