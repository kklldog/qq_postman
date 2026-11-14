import type { IncomingMail } from './types.js';

export type MailSubscriber = (mail: IncomingMail) => void;

export class MailEventHub {
  private readonly subscribers = new Set<MailSubscriber>();

  subscribe(subscriber: MailSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  publish(mail: IncomingMail): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(mail);
      } catch (error) {
        console.error('Mail subscriber failed:', error);
      }
    }
  }

  get size(): number {
    return this.subscribers.size;
  }
}
