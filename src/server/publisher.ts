/**
 * Publisher: sends to queues or topics with transport backpressure handling
 * and guaranteed-message acknowledgement tracking. Operates on the session
 * owned by the Manager, which forwards ack/reject/capacity events here.
 */

import { solace } from './solace';
import { config } from './config';
import type { PublishRequest, PublishResult, DeliveryMode, DestinationType } from './types';

interface Pending {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class Publisher {
  private pending = new Map<string, Pending>();
  private counter = 0;
  private canAccept = true;
  private acceptWaiters: Array<() => void> = [];

  metrics = {
    published: 0,
    acked: 0,
    rejected: 0,
    timeouts: 0,
    backpressureWaits: 0,
    lastError: null as string | null,
  };

  /** Called by the Manager from the session ACKNOWLEDGED_MESSAGE event. */
  onAck(correlationKey: unknown): void {
    const key = typeof correlationKey === 'string' ? correlationKey : '';
    const p = this.pending.get(key);
    if (p) {
      clearTimeout(p.timer);
      this.pending.delete(key);
      this.metrics.acked += 1;
      p.resolve();
    }
  }

  /** Called from the session REJECTED_MESSAGE_ERROR event. */
  onReject(correlationKey: unknown, message: string): void {
    const key = typeof correlationKey === 'string' ? correlationKey : '';
    const p = this.pending.get(key);
    if (p) {
      clearTimeout(p.timer);
      this.pending.delete(key);
      this.metrics.rejected += 1;
      p.reject(new Error(message || 'Message rejected by broker'));
    }
  }

  /** Called from the session CAN_ACCEPT_DATA event. */
  onCanAcceptData(): void {
    this.canAccept = true;
    const waiters = this.acceptWaiters;
    this.acceptWaiters = [];
    for (const w of waiters) w();
  }

  /** Reject everything in flight (session went down). */
  failAll(reason: string): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    this.pending.clear();
    this.canAccept = true;
    this.acceptWaiters = [];
  }

  private waitForCapacity(): Promise<void> {
    if (this.canAccept) return Promise.resolve();
    this.metrics.backpressureWaits += 1;
    return new Promise((resolve) => this.acceptWaiters.push(resolve));
  }

  private async sendWithBackpressure(session: solace.Session, message: solace.Message): Promise<void> {
    await this.waitForCapacity();
    try {
      session.send(message);
    } catch (e) {
      const subcode = (e as { subcode?: number })?.subcode;
      if (subcode !== solace.ErrorSubcode.INSUFFICIENT_SPACE) throw e;
      this.canAccept = false;
      await this.waitForCapacity();
      session.send(message);
    }
  }

  private buildMessage(type: DestinationType, name: string, body: unknown, mode: DeliveryMode) {
    const message = solace.SolclientFactory.createMessage();
    const dest = type === 'queue'
      ? solace.SolclientFactory.createDurableQueueDestination(name)
      : solace.SolclientFactory.createTopicDestination(name);
    message.setDestination(dest);
    const payload = body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body));
    message.setBinaryAttachment(payload);
    message.setDeliveryMode(mode === 'direct'
      ? solace.MessageDeliveryModeType.DIRECT
      : solace.MessageDeliveryModeType.PERSISTENT);
    return { message, bytes: Buffer.byteLength(payload) };
  }

  private async publishOne(
    session: solace.Session,
    type: DestinationType,
    name: string,
    body: unknown,
    mode: DeliveryMode,
  ): Promise<number> {
    const { message, bytes } = this.buildMessage(type, name, body, mode);

    if (mode === 'direct') {
      await this.sendWithBackpressure(session, message);
      this.metrics.published += 1;
      return bytes;
    }

    const key = `pub-${++this.counter}-${this.pending.size}`;
    message.setCorrelationKey(key);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(key)) {
          this.pending.delete(key);
          this.metrics.timeouts += 1;
          reject(new Error(`Publish ack timeout after ${config.resilience.publishAckTimeoutMs}ms`));
        }
      }, config.resilience.publishAckTimeoutMs);
      this.pending.set(key, { resolve, reject, timer });
      this.sendWithBackpressure(session, message).catch((e: Error) => {
        clearTimeout(timer);
        this.pending.delete(key);
        reject(e);
      });
    });
    this.metrics.published += 1;
    return bytes;
  }

  /** Publish a single message or a batch (replay). */
  async publish(session: solace.Session, req: PublishRequest): Promise<PublishResult> {
    const name = req.destinationName.trim();
    const mode: DeliveryMode = req.deliveryMode === 'direct' ? 'direct' : 'persistent';
    const entries = req.batch && req.batch.length ? req.batch : [req.body ?? ''];

    const result: PublishResult = {
      destinationType: req.destinationType,
      destinationName: name,
      count: entries.length,
      acknowledged: 0,
      bytes: 0,
      failures: [],
    };

    for (let i = 0; i < entries.length; i++) {
      try {
        const bytes = await this.publishOne(session, req.destinationType, name, entries[i], mode);
        result.bytes += bytes;
        if (mode === 'persistent') result.acknowledged += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.metrics.lastError = msg;
        result.failures.push({ index: i, error: msg });
      }
    }
    return result;
  }
}
