export interface MailAddress {
  address: string;
  name?: string;
}

export interface MailAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentBase64?: string;
  truncated?: boolean;
  cid?: string;
}

export interface IncomingMail {
  id: string;
  uid: number;
  messageId?: string;
  receivedAt: string;
  date?: string;
  from: MailAddress[];
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  replyTo: MailAddress[];
  subject: string;
  text: string;
  html?: string;
  headers: Record<string, string>;
  attachments: MailAttachment[];
}

export interface SendMailInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    contentBase64: string;
    contentType?: string;
  }>;
}

export interface WatcherStatus {
  connected: boolean;
  mailbox: string;
  lastUid: number;
  processedCount: number;
  lastError?: string;
  lastMessageAt?: string;
}

export interface PublicSettings {
  email: string;
  hasAuthCode: boolean;
  configured: boolean;
  watcher: WatcherStatus;
}
