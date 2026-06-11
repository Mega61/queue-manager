/**
 * Shared Solace factory init + session-property construction with the
 * resilience tuning that keeps a long-running session alive on a VM.
 *
 * NOTE: `solclientjs` is a CommonJS SDK that must run in the long-lived Node
 * process. It is kept out of the bundler via `serverExternalPackages` in
 * next.config.ts. Only import this module from server code (route handlers
 * with `runtime = 'nodejs'`).
 */

import * as solace from 'solclientjs';
import { config } from './config';
import type { Connection } from './types';

let initialized = false;

export function initSolace(): void {
  if (initialized) return;
  const props = new solace.SolclientFactoryProperties();
  props.profile = solace.SolclientFactoryProfiles.version10;
  props.logLevel = solace.LogLevel.WARN;
  solace.SolclientFactory.init(props);
  initialized = true;
}

/** Build resilient session properties for a connection. */
export function buildSessionProps(
  conn: Connection,
  opts: { withPublisher?: boolean } = {},
): solace.SessionProperties {
  const r = config.resilience;
  const props: Record<string, unknown> = {
    url: conn.url,
    vpnName: conn.vpnName,
    userName: conn.userName,
    password: conn.password,
    connectRetries: r.connectRetries,
    reconnectRetries: r.reconnectRetries,
    reconnectRetryWaitInMsecs: r.reconnectWaitMs,
    connectTimeoutInMsecs: r.connectTimeoutMs,
    keepAliveIntervalInMsecs: r.keepAliveIntervalMs,
    keepAliveIntervalsLimit: r.keepAliveLimit,
    reapplySubscriptions: true,
    connectRetriesPerHost: -1,
  };
  if (conn.clientName && conn.clientName.trim()) {
    props.clientName = conn.clientName.trim();
  }
  if (opts.withPublisher) {
    props.publisherProperties = {
      enabled: true,
      acknowledgeMode: solace.MessagePublisherAcknowledgeMode.PER_MESSAGE,
      windowSize: 50,
      acknowledgeTimeoutInMsecs: r.publishAckTimeoutMs,
    };
  }
  return props as unknown as solace.SessionProperties;
}

export { solace };
