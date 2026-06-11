/** Process-wide event bus fanning manager events out to SSE clients. */

import { EventEmitter } from 'events';
import type { BusEvent } from './types';

export class MessageBus extends EventEmitter {
  constructor() {
    super();
    // Many concurrent SSE streams may subscribe; lift the default cap.
    this.setMaxListeners(0);
  }
  emitEvent(event: BusEvent): void {
    this.emit('event', event);
  }
  subscribe(listener: (event: BusEvent) => void): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }
}
