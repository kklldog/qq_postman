# QQ Postman

一个可直接部署的 QQ 邮箱桥接服务：

- 使用 QQ 邮箱的 `SMTP_AUTHCODE` 通过 SMTP 发信。
- 使用 IMAP 定时拉取新邮件，断线自动重连。
- 通过 SSE 订阅通道实时推送收到的邮件。
- 可选把同一邮件投递到固定 Webhook。
- 使用 UID 状态文件去重，服务重启后不会重复推送。

## 运行

需要 Node.js 20 或更新版本。

```bash
npm install
copy .env.example .env
```

在 `.env` 中填写 QQ 邮箱和授权码：

```env
QQ_EMAIL=123456789@qq.com
SMTP_AUTHCODE=QQ邮箱设置中生成的授权码
```

QQ 邮箱网页端需要先开启 **IMAP/SMTP 服务**。这里的授权码是邮箱设置里生成的第三方客户端授权码，不是 QQ 登录密码。

```bash
npm run dev
# 或
npm run build
npm start
```

默认监听 `http://localhost:3000`。

打开 `http://localhost:3000/` 可以在页面配置 QQ 邮箱和 `SMTP_AUTHCODE`。点击“保存并重新监听”后，服务会保存账号配置、重建 SMTP 客户端并重启 IMAP 监听。授权码不会从接口返回；页面上的授权码输入框留空时会保留当前授权码。

页面配置接口使用 `ADMIN_API_KEY`；如果没有设置，则沿用 `API_KEY`。未配置密钥时适合内网开发环境，生产环境建议设置 `ADMIN_API_KEY`。

## 发信接口

`POST /api/send` 接收 JSON。`to` 可以是字符串或字符串数组，必须提供 `text` 或 `html` 之一。
请求体上限为 32 MiB，适用于带图片附件的预览邮件。

```bash
curl -X POST http://localhost:3000/api/send \
  -H "content-type: application/json" \
  -d '{
    "to": "someone@example.com",
    "subject": "测试邮件",
    "text": "你好，这是正文。"
  }'
```

附件使用 base64：

```json
{
  "to": ["a@example.com", "b@example.com"],
  "subject": "带附件",
  "html": "<p>请查收</p>",
  "attachments": [
    {
      "filename": "hello.txt",
      "contentBase64": "SGVsbG8=",
      "contentType": "text/plain"
    }
  ]
}
```

如果设置了 `API_KEY`，请求需要携带 `x-api-key`，或 `Authorization: Bearer <API_KEY>`。

## 收信订阅

使用浏览器、curl 或任何支持 SSE 的客户端连接：

```bash
curl -N http://localhost:3000/api/subscribe
```

每封新邮件都会收到一个 `mail` 事件，`data` 是 JSON，包含发件人、收件人、主题、纯文本正文、HTML 正文、邮件头和附件（附件内容默认是 base64）。例如：

```text
event: mail
data: {"id":"...","uid":42,"subject":"你好", ...}
```

SSE 连接会每 15 秒发送心跳，客户端断线后应按服务端的 `retry: 5000` 自动重连。

## Webhook（可选）

设置 `WEBHOOK_URL` 后，每封新邮件还会向该地址发送 JSON `POST`。服务会在超时或非 2xx 时按 `WEBHOOK_RETRIES` 重试。设置 `WEBHOOK_SECRET` 时，会附加：

```text
X-QQ-Postman-Signature: HMAC-SHA256(body, WEBHOOK_SECRET)
```

## 健康检查

`GET /health` 返回监听状态、最近处理的 UID、订阅连接数和最近错误：

`watcher.connected` 表示最近一次 IMAP 检查是否成功；轮询模式下服务会在每次检查后主动释放连接。

```json
{
  "status": "ok",
  "watcher": {
    "connected": true,
    "mailbox": "INBOX",
    "lastUid": 42,
    "processedCount": 3
  },
  "subscribers": 1
}
```

## 配置说明

完整配置见 `.env.example`。QQ 默认服务器是 `smtp.qq.com:465`（SSL）和 `imap.qq.com:993`（SSL）。首次启动默认只监听启动后的新邮件；如需把现有邮件也推送一次，设置 `MAIL_INITIAL_SYNC=true`。
