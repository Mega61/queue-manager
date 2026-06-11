/**
 * Non-secret operational configuration from the environment.
 * Broker credentials are NEVER read here — they are supplied per session
 * through the UI and never persisted server-side.
 */

function bool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function int(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  logLevel: process.env.LOG_LEVEL ?? 'info',
  logJson: bool(process.env.LOG_JSON, process.env.NODE_ENV === 'production'),

  // In-memory ring buffer of received messages
  bufferSize: int(process.env.MESSAGE_BUFFER_SIZE, 1000),

  // Resilience tuning applied to the Solace session (non-secret).
  resilience: {
    connectRetries: int(process.env.SOLACE_CONNECT_RETRIES, 5),
    reconnectRetries: int(process.env.SOLACE_RECONNECT_RETRIES, -1),
    reconnectWaitMs: int(process.env.SOLACE_RECONNECT_WAIT_MS, 3000),
    connectTimeoutMs: int(process.env.SOLACE_CONNECT_TIMEOUT_MS, 10000),
    keepAliveIntervalMs: int(process.env.SOLACE_KEEPALIVE_MS, 3000),
    keepAliveLimit: int(process.env.SOLACE_KEEPALIVE_LIMIT, 10),
    consumerReconnectAttempts: int(process.env.SOLACE_CONSUMER_RECONNECT, -1),
    consumerReconnectWaitMs: int(process.env.SOLACE_CONSUMER_RECONNECT_WAIT_MS, 3000),
    publishAckTimeoutMs: int(process.env.SOLACE_PUBLISH_ACK_TIMEOUT_MS, 10000),
  },
} as const;

export { bool, int };
