/**
 * SolaceManager — the process-wide singleton that owns ONE session per
 * connection and hosts many concurrent subscriptions (queue flows + topic
 * taps), a publisher, a bounded message buffer, and an event bus for SSE.
 *
 * Stashed on globalThis so it survives Next.js dev HMR and is shared across
 * route-handler module instances. Must run in the Node.js runtime.
 */

import { solace, initSolace, buildSessionProps } from './solace';
import { config } from './config';
import { createLogger } from './logger';
import { Publisher } from './publisher';
import { MessageBuffer } from './buffer';
import { MessageBus } from './bus';
import { decodeMessage, topicMatches } from './subscriptions';
import type {
  Connection, SafeConnection, ConnectionPhase, ManagerStatus,
  Subscription, SubscriptionRequest, PublishRequest, PublishResult, BrokerMessage,
} from './types';

const log = createLogger('manager');

interface SubEntry {
  sub: Subscription;
  flow?: solace.MessageConsumer; // present for queue / guaranteed-topic
  topicDest?: solace.Destination; // present for direct topic (for routing)
}

export class SolaceManager {
  private session: solace.Session | null = null;
  private safeConn: SafeConnection | null = null;
  private phase: ConnectionPhase = 'disconnected';
  private connectedAt: string | null = null;
  private reconnects = 0;
  private lastError: string | null = null;
  private idCounter = 0;

  private subs = new Map<string, SubEntry>();
  private readonly publisher = new Publisher();
  private readonly buffer = new MessageBuffer(config.bufferSize);
  readonly bus = new MessageBus();
  private pendingConnect: { resolve: () => void; reject: (e: Error) => void } | null = null;

  // ---- lifecycle ----

  isConnected(): boolean {
    return Boolean(this.session) && this.phase === 'connected';
  }

  async connect(conn: Connection): Promise<void> {
    if (this.session) throw new Error('Already connected. Disconnect first.');
    initSolace();
    this.phase = 'connecting';
    this.lastError = null;
    this.broadcastStatus();

    const session = solace.SolclientFactory.createSession(buildSessionProps(conn, { withPublisher: true }));
    this.session = session;
    this.wireSession(session);

    try {
      await new Promise<void>((resolve, reject) => {
        this.pendingConnect = { resolve, reject };
        session.connect();
      });
    } catch (e) {
      this.pendingConnect = null;
      this.teardown();
      throw e instanceof Error ? e : new Error(String(e));
    }

    this.safeConn = { url: conn.url, vpnName: conn.vpnName, userName: conn.userName, clientName: conn.clientName };
    this.phase = 'connected';
    this.connectedAt = new Date().toISOString();
    log.info('connected', { vpn: conn.vpnName });
    this.broadcastStatus();
  }

  private wireSession(session: solace.Session): void {
    session.on(solace.SessionEventCode.UP_NOTICE, () => {
      this.phase = 'connected';
      if (this.pendingConnect) { this.pendingConnect.resolve(); this.pendingConnect = null; }
      this.broadcastStatus();
    });
    session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (e: solace.SessionEvent) => {
      const message = e?.infoStr || 'Connect failed';
      if (this.pendingConnect) { this.pendingConnect.reject(new Error(message)); this.pendingConnect = null; }
      else this.reportError('session', message);
    });
    session.on(solace.SessionEventCode.RECONNECTING_NOTICE, (e: solace.SessionEvent) => {
      this.reconnects += 1;
      this.phase = 'reconnecting';
      log.warn('reconnecting', { reason: e?.infoStr });
      this.broadcastStatus();
    });
    session.on(solace.SessionEventCode.RECONNECTED_NOTICE, () => {
      this.phase = 'connected';
      this.broadcastStatus();
    });
    session.on(solace.SessionEventCode.DISCONNECTED, () => {
      log.info('session disconnected');
      this.publisher.failAll('Session disconnected');
      this.teardown();
    });
    session.on(solace.SessionEventCode.DOWN_ERROR, (e: solace.SessionEvent) => {
      this.reportError('session', e?.infoStr || 'Session down');
    });

    session.on(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE, (e: solace.SessionEvent) => {
      this.publisher.onAck(e?.correlationKey);
    });
    session.on(solace.SessionEventCode.REJECTED_MESSAGE_ERROR, (e: solace.SessionEvent) => {
      this.publisher.onReject(e?.correlationKey, e?.infoStr || 'Rejected by broker');
    });
    session.on(solace.SessionEventCode.CAN_ACCEPT_DATA, () => {
      this.publisher.onCanAcceptData();
    });

    // Direct (topic-tap) messages arrive at the session level.
    session.on(solace.SessionEventCode.MESSAGE, (message: solace.Message) => {
      this.handleDirectMessage(message);
    });

    // Confirmation for session.subscribe() on direct topic subscriptions.
    session.on(solace.SessionEventCode.SUBSCRIPTION_OK, (e: solace.SessionEvent) => {
      this.setSubPhase(String(e?.correlationKey ?? ''), 'up');
    });
    session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, (e: solace.SessionEvent) => {
      const id = String(e?.correlationKey ?? '');
      this.setSubPhase(id, 'error', e?.infoStr || 'Subscription error');
    });
  }

  async disconnect(): Promise<void> {
    for (const id of [...this.subs.keys()]) {
      try { await this.removeSubscription(id); } catch { /* best effort */ }
    }
    try { this.session?.disconnect(); } catch { /* ignore */ }
    this.teardown();
  }

  private teardown(): void {
    for (const [, entry] of this.subs) {
      try { entry.flow?.dispose(); } catch { /* ignore */ }
    }
    this.subs.clear();
    try { this.session?.dispose(); } catch { /* ignore */ }
    this.session = null;
    this.safeConn = null;
    this.phase = 'disconnected';
    this.connectedAt = null;
    this.broadcastStatus();
  }

  // ---- subscriptions ----

  async addSubscription(req: SubscriptionRequest): Promise<Subscription> {
    if (!this.session) throw new Error('Not connected');
    const name = req.name?.trim();
    if (!name) throw new Error('Subscription name/topic is required');

    const id = `sub-${++this.idCounter}`;
    const autoAck = req.autoAck !== false;
    const sub: Subscription = {
      id, type: req.type, name,
      topicMode: req.type === 'topic' ? (req.topicMode ?? 'direct') : undefined,
      backingQueue: req.backingQueue,
      autoAck,
      phase: 'binding',
      received: 0, lastMessageAt: null, lastError: null,
      createdAt: new Date().toISOString(),
    };

    if (req.type === 'topic' && sub.topicMode === 'direct') {
      const topicDest = solace.SolclientFactory.createTopicDestination(name);
      this.subs.set(id, { sub, topicDest });
      this.session.subscribe(topicDest, true, id, config.resilience.connectTimeoutMs);
    } else {
      // queue flow OR guaranteed topic (queue-backed flow + topic subscription)
      const flow = this.createFlow(sub);
      this.subs.set(id, { sub, flow });
    }

    log.info('subscription added', { id, type: sub.type, name, mode: sub.topicMode });
    this.broadcastStatus();
    return sub;
  }

  private createFlow(sub: Subscription): solace.MessageConsumer {
    const session = this.session!;
    const guaranteedTopic = sub.type === 'topic' && sub.topicMode === 'guaranteed';
    const queueName = sub.type === 'queue' ? sub.name : sub.backingQueue;

    const consumerProps: Record<string, unknown> = {
      queueDescriptor: queueName
        ? { name: queueName, type: solace.QueueType.QUEUE, durable: true }
        : { type: solace.QueueType.QUEUE, durable: false }, // temporary endpoint
      acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT,
      createIfMissing: !queueName, // create the temporary endpoint when unnamed
      reconnectAttempts: config.resilience.consumerReconnectAttempts,
      reconnectIntervalInMsecs: config.resilience.consumerReconnectWaitMs,
    };
    const flow = session.createMessageConsumer(consumerProps as unknown as solace.MessageConsumerProperties);

    flow.on(solace.MessageConsumerEventName.UP, () => {
      this.setSubPhase(sub.id, 'up');
      if (guaranteedTopic) {
        try {
          const topicDest = solace.SolclientFactory.createTopicDestination(sub.name);
          flow.addSubscription(topicDest, sub.id, config.resilience.connectTimeoutMs);
        } catch (e) {
          this.setSubPhase(sub.id, 'error', e instanceof Error ? e.message : String(e));
        }
      }
    });
    flow.on(solace.MessageConsumerEventName.RECONNECTING, () => this.setSubPhase(sub.id, 'reconnecting'));
    flow.on(solace.MessageConsumerEventName.RECONNECTED, () => this.setSubPhase(sub.id, 'up'));
    flow.on(solace.MessageConsumerEventName.DOWN, () => this.setSubPhase(sub.id, 'down'));
    flow.on(solace.MessageConsumerEventName.DOWN_ERROR, (e: solace.OperationError) =>
      this.setSubPhase(sub.id, 'error', e?.message || 'Flow down'));
    flow.on(solace.MessageConsumerEventName.CONNECT_FAILED_ERROR, (e: solace.OperationError) =>
      this.setSubPhase(sub.id, 'error', e?.message || 'Bind failed'));
    flow.on(solace.MessageConsumerEventName.GM_DISABLED, () =>
      this.setSubPhase(sub.id, 'error', 'Guaranteed messaging disabled on this queue/VPN'));
    flow.on(solace.MessageConsumerEventName.MESSAGE, (message: solace.Message) => {
      this.ingest(message, sub, flow);
    });

    flow.connect();
    return flow;
  }

  async removeSubscription(id: string): Promise<void> {
    const entry = this.subs.get(id);
    if (!entry) throw new Error('Subscription not found');
    if (entry.flow) {
      try { entry.flow.disconnect(); } catch { /* ignore */ }
      try { entry.flow.dispose(); } catch { /* ignore */ }
    } else if (entry.topicDest && this.session) {
      try { this.session.unsubscribe(entry.topicDest, true, id, config.resilience.connectTimeoutMs); } catch { /* ignore */ }
    }
    this.subs.delete(id);
    log.info('subscription removed', { id });
    this.broadcastStatus();
  }

  private setSubPhase(id: string, phase: Subscription['phase'], error?: string): void {
    const entry = this.subs.get(id);
    if (!entry) return;
    entry.sub.phase = phase;
    if (error) entry.sub.lastError = error;
    this.broadcastStatus();
  }

  // ---- message ingestion ----

  private handleDirectMessage(message: solace.Message): void {
    const topic = message.getDestination?.()?.getName?.() ?? '';
    // Attribute to the first direct subscription whose pattern matches.
    for (const [, entry] of this.subs) {
      if (entry.sub.type === 'topic' && entry.sub.topicMode === 'direct'
          && topicMatches(entry.sub.name, topic)) {
        this.ingest(message, entry.sub, undefined);
        return;
      }
    }
  }

  private ingest(message: solace.Message, sub: Subscription, flow?: solace.MessageConsumer): void {
    try {
      const decoded = decodeMessage(message, `local-${this.buffer.lastSeq + 1}`);
      const record: Omit<BrokerMessage, 'seq'> = {
        id: decoded.id,
        subscriptionId: sub.id,
        source: sub.name,
        sourceType: sub.type,
        topic: decoded.topic,
        applicationMessageId: decoded.applicationMessageId,
        correlationId: decoded.correlationId,
        redelivered: decoded.redelivered,
        priority: decoded.priority,
        bytes: decoded.bytes,
        time: new Date().toISOString(),
        body: decoded.body,
      };
      const full = this.buffer.push(record);
      sub.received += 1;
      sub.lastMessageAt = full.time;
      this.bus.emitEvent({ kind: 'message', data: full });
    } catch (e) {
      this.reportError('message', e instanceof Error ? e.message : String(e));
      return; // do not ack a message we failed to process
    }
    if (flow && sub.autoAck) {
      try { message.acknowledge(); } catch { /* redelivered later */ }
    }
  }

  // ---- publishing ----

  async publish(req: PublishRequest): Promise<PublishResult> {
    if (!this.session) throw new Error('Not connected');
    const result = await this.publisher.publish(this.session, req);
    this.broadcastStatus();
    return result;
  }

  // ---- status / messages ----

  private reportError(where: string, message: string): void {
    this.lastError = message;
    if (this.phase === 'connected' || this.phase === 'connecting') this.phase = 'error';
    log.error('error', { where, message });
    this.bus.emitEvent({ kind: 'error', data: { where, message } });
  }

  status(): ManagerStatus {
    const m = this.publisher.metrics;
    return {
      connection: {
        phase: this.phase,
        config: this.safeConn,
        connectedAt: this.connectedAt,
        reconnects: this.reconnects,
        lastError: this.lastError,
      },
      subscriptions: [...this.subs.values()].map((e) => ({ ...e.sub })),
      publisher: {
        published: m.published, acked: m.acked, rejected: m.rejected,
        timeouts: m.timeouts, backpressureWaits: m.backpressureWaits, lastError: m.lastError,
      },
      buffer: { size: this.buffer.size, capacity: this.buffer.cap, lastSeq: this.buffer.lastSeq },
    };
  }

  private broadcastStatus(): void {
    this.bus.emitEvent({ kind: 'status', data: this.status() });
  }

  messagesAfter(cursor: number, limit?: number): BrokerMessage[] {
    return this.buffer.after(cursor, limit);
  }
  allMessages(): BrokerMessage[] {
    return this.buffer.all();
  }
  getMessage(id: string): BrokerMessage | undefined {
    return this.buffer.get(id);
  }
  clearMessages(): void {
    this.buffer.clear();
    this.broadcastStatus();
  }
}

// ---- globalThis singleton ----
const g = globalThis as unknown as { __aqmManager?: SolaceManager };
export function getManager(): SolaceManager {
  if (!g.__aqmManager) g.__aqmManager = new SolaceManager();
  return g.__aqmManager;
}
