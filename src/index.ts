import { buildHttpServer } from './http-server.js';
import { loadConfig } from './config.js';
import { MailEventHub } from './event-hub.js';
import { MailSender } from './mail-sender.js';
import { MailWatcher } from './mail-watcher.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const hub = new MailEventHub();
  const sender = new MailSender(config);
  const watcher = new MailWatcher(config, hub);
  const app = buildHttpServer(config, sender, watcher, hub);

  await app.listen({ host: config.http.host, port: config.http.port });
  await watcher.start();
  app.log.info(`QQ Postman listening on http://${config.http.host}:${config.http.port}`);

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down`);
    await watcher.stop();
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
