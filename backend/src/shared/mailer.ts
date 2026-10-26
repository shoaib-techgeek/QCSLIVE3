export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Provider-specific delivery (SMTP, SES, ...) lives behind this interface. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Development driver: prints the message instead of delivering it. */
export class LogMailer implements Mailer {
  constructor(private readonly log: { info: (obj: object, msg: string) => void }) {}
  async send(message: MailMessage): Promise<void> {
    this.log.info({ mail: message }, 'mail not delivered (log driver)');
  }
}

/** Test driver: captures messages so tests can read links. */
export class MemoryMailer implements Mailer {
  readonly outbox: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
  }
  lastTo(to: string): MailMessage | undefined {
    return [...this.outbox].reverse().find((m) => m.to === to);
  }
}
