/** Bounded in-memory ring buffer of received messages. */

import type { BrokerMessage } from './types';

export class MessageBuffer {
  private items: BrokerMessage[] = [];
  private seq = 0;
  constructor(private readonly capacity: number) {}

  /** Append a message, assigning a monotonic seq; evicts the oldest past cap. */
  push(msg: Omit<BrokerMessage, 'seq'>): BrokerMessage {
    const full: BrokerMessage = { ...msg, seq: ++this.seq };
    this.items.push(full);
    if (this.capacity > 0 && this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity);
    }
    return full;
  }

  /** Messages with seq > cursor (for SSE backfill), newest last. */
  after(cursor: number, limit = 1000): BrokerMessage[] {
    const out = this.items.filter((m) => m.seq > cursor);
    return out.slice(-limit);
  }

  /** All buffered messages, oldest first. */
  all(): BrokerMessage[] {
    return this.items.slice();
  }

  get(id: string): BrokerMessage | undefined {
    // Match by broker id, falling back to seq for uniqueness.
    return [...this.items].reverse().find((m) => m.id === id || String(m.seq) === id);
  }

  clear(): void {
    this.items = [];
  }

  get size(): number {
    return this.items.length;
  }
  get cap(): number {
    return this.capacity;
  }
  get lastSeq(): number {
    return this.seq;
  }
}
