import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailEventHub } from './event-hub.js';
import type { IncomingMail } from './types.js';

const mail: IncomingMail = {
  id: 'mail-1',
  uid: 1,
  receivedAt: '2026-01-01T00:00:00.000Z',
  from: [],
  to: [],
  cc: [],
  bcc: [],
  replyTo: [],
  subject: 'test',
  text: 'hello',
  headers: {},
  attachments: [],
};

describe('MailEventHub', () => {
  afterEach(() => vi.restoreAllMocks());

  it('publishes to active subscribers and removes them on unsubscribe', () => {
    const hub = new MailEventHub();
    const received: IncomingMail[] = [];
    const unsubscribe = hub.subscribe((value) => received.push(value));

    hub.publish(mail);
    unsubscribe();
    hub.publish({ ...mail, id: 'mail-2', uid: 2 });

    expect(received).toEqual([mail]);
    expect(hub.size).toBe(0);
  });

  it('isolates subscriber errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hub = new MailEventHub();
    const received: IncomingMail[] = [];
    hub.subscribe(() => { throw new Error('expected'); });
    hub.subscribe((value) => received.push(value));

    expect(() => hub.publish(mail)).not.toThrow();
    expect(received).toEqual([mail]);
  });
});
