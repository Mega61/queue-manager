/** Shared server-side domain types for the Solace queue manager. */

export interface Connection {
  url: string;
  vpnName: string;
  userName: string;
  password: string;
  clientName?: string;
}

/** Connection without the password — safe to return to the browser. */
export type SafeConnection = Omit<Connection, 'password'>;

export type DestinationType = 'queue' | 'topic';
export type DeliveryMode = 'persistent' | 'direct';
/** How a topic subscription consumes: live direct tap or guaranteed via a queue. */
export type TopicMode = 'direct' | 'guaranteed';

export interface SubscriptionRequest {
  type: DestinationType;
  /** Queue name (type=queue) or topic string (type=topic). */
  name: string;
  /** Topic delivery mode; ignored for queues. */
  topicMode?: TopicMode;
  /** Backing queue for guaranteed topic mode (durable). Optional → temporary. */
  backingQueue?: string;
  /** Auto-acknowledge (consume) guaranteed messages. Ignored for direct topics. Default true. */
  autoAck?: boolean;
}

export type SubscriptionPhase =
  | 'binding'
  | 'up'
  | 'reconnecting'
  | 'down'
  | 'error'
  | 'removed';

export interface Subscription {
  id: string;
  type: DestinationType;
  name: string;
  topicMode?: TopicMode;
  backingQueue?: string;
  autoAck: boolean;
  phase: SubscriptionPhase;
  received: number;
  lastMessageAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface BrokerMessage {
  /** Monotonic local cursor for backfill/dedup. */
  seq: number;
  id: string;
  subscriptionId: string;
  source: string; // queue or topic that delivered it
  sourceType: DestinationType;
  topic: string;
  applicationMessageId: string | null;
  correlationId: string | null;
  redelivered: boolean;
  priority: number | null;
  bytes: number;
  time: string;
  body: string;
}

export interface PublishRequest {
  destinationType: DestinationType;
  destinationName: string;
  deliveryMode: DeliveryMode;
  /** Single payload, OR use `batch` for many. */
  body?: unknown;
  /** Batch / replay: each entry published as its own message. */
  batch?: unknown[];
}

export interface PublishResult {
  destinationType: DestinationType;
  destinationName: string;
  count: number;
  acknowledged: number;
  bytes: number;
  failures: { index: number; error: string }[];
}

export type ConnectionPhase =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface ManagerStatus {
  connection: {
    phase: ConnectionPhase;
    config: SafeConnection | null;
    connectedAt: string | null;
    reconnects: number;
    lastError: string | null;
  };
  subscriptions: Subscription[];
  publisher: {
    published: number;
    acked: number;
    rejected: number;
    timeouts: number;
    backpressureWaits: number;
    lastError: string | null;
  };
  buffer: { size: number; capacity: number; lastSeq: number };
}

/** SSE event envelope sent to the browser. */
export type BusEvent =
  | { kind: 'status'; data: ManagerStatus }
  | { kind: 'message'; data: BrokerMessage }
  | { kind: 'error'; data: { where: string; message: string } };
