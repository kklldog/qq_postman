import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ImapFlow, type FetchMessageObject } from 'imapflow';
import type { Config } from './config.js';
import type { MailEventHub } from './event-hub.js';
import { parseIncomingMail } from './mail-parser.js';
import type { WatcherStatus } from './types.js';

interface StateFile {
  lastUid: number;
}

class UidStore {
  constructor(private readonly file: string) {}

  async read(): Promise<number | undefined> {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8')) as StateFile;
      return Number.isInteger(value.lastUid) && value.lastUid >= 0 ? value.lastUid : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      console.error('Could not read mail state:', error);
      return undefined;
    }
  }

  async write(lastUid: number): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify({ lastUid }, null, 2), 'utf8');
  }
}

export class MailWatcher {
  private running = false;
  private cycleInProgress = false;
  private lastUid = 0;
  private processedCount = 0;
  private lastError: string | undefined;
  private lastMessageAt: string | undefined;
  private connected = false;
  private loopPromise: Promise<void> | undefined;
  private sleepTimer: NodeJS.Timeout | undefined;
  private sleepResolve: (() => void) | undefined;
  private readonly store: UidStore;

  constructor(private readonly config: Config, private readonly hub: MailEventHub) {
    this.store = new UidStore(config.watcher.stateFile);
  }

  getStatus(): WatcherStatus {
    return {
      connected: this.connected,
      mailbox: this.config.imap.mailbox,
      lastUid: this.lastUid,
      processedCount: this.processedCount,
      ...(this.lastError ? { lastError: this.lastError } : {}),
      ...(this.lastMessageAt ? { lastMessageAt: this.lastMessageAt } : {}),
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.lastUid = (await this.store.read()) ?? 0;
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    if (!this.running && !this.loopPromise) return;
    this.running = false;
    this.connected = false;
    this.cancelSleep();
    while (this.cycleInProgress) await new Promise((resolve) => setTimeout(resolve, 50));
    await this.loopPromise;
    this.loopPromise = undefined;
  }

  private async loop(): Promise<void> {
    let backoff = this.config.watcher.pollIntervalMs;
    while (this.running) {
      try {
        await this.scanOnce();
        backoff = this.config.watcher.pollIntervalMs;
      } catch (error) {
        this.connected = false;
        this.lastError = error instanceof Error ? error.message : String(error);
        console.error('IMAP watcher error:', error);
        backoff = Math.min(Math.max(backoff * 2, 1_000), 120_000);
      }
      if (this.running) await this.sleep(backoff);
    }
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.sleepResolve = resolve;
      this.sleepTimer = setTimeout(() => {
        this.sleepTimer = undefined;
        this.sleepResolve = undefined;
        resolve();
      }, milliseconds);
    });
  }

  private cancelSleep(): void {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = undefined;
    const resolve = this.sleepResolve;
    this.sleepResolve = undefined;
    resolve?.();
  }

  private async scanOnce(): Promise<void> {
    this.cycleInProgress = true;
    const client = new ImapFlow({
      host: this.config.imap.host,
      port: this.config.imap.port,
      secure: this.config.imap.secure,
      auth: { user: this.config.account.email, pass: this.config.account.authCode },
      logger: false,
    });
    try {
      await client.connect();
      this.connected = true;
      this.lastError = undefined;
      const lock = await client.getMailboxLock(this.config.imap.mailbox);
      try {
        const mailbox = client.mailbox;
        const nextUid = mailbox ? mailbox.uidNext ?? 1 : 1;
        if (!this.config.watcher.initialSync && this.lastUid === 0) {
          this.lastUid = Math.max(0, nextUid - 1);
          await this.store.write(this.lastUid);
          return;
        }
        const startUid = Math.max(1, this.lastUid + 1);
        const endUid = Math.max(0, nextUid - 1);
        if (startUid > endUid) return;

        for await (const message of client.fetch(`${startUid}:${endUid}`, { source: true, uid: true }, { uid: true })) {
          await this.processMessage(message);
        }
      } finally {
        lock.release();
      }
    } finally {
      this.cycleInProgress = false;
      await client.logout().catch(() => undefined);
    }
  }

  private async processMessage(message: FetchMessageObject): Promise<void> {
    const uid = message.uid;
    if (!uid || !message.source) return;
    try {
      const mail = await parseIncomingMail(message.source, uid, this.config);
      this.hub.publish(mail);
      this.processedCount += 1;
      this.lastMessageAt = new Date().toISOString();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error(`Could not parse message UID ${uid}:`, error);
    } finally {
      this.lastUid = Math.max(this.lastUid, uid);
      await this.store.write(this.lastUid);
    }
  }
}
