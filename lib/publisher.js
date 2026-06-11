const solace = require('solclientjs').debug;

let initialized = false;
function init() {
  if (initialized) return;
  solace.SolclientFactory.init({ profile: solace.SolclientFactoryProfiles.version10 });
  solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
  initialized = true;
}

let session = null;
let connecting = null;
let active = null;
const pending = new Map();
let correlationCounter = 0;
const ACK_TIMEOUT_MS = 10000;

function sameConn(a, b) {
  return a && b
    && a.url === b.url
    && a.vpnName === b.vpnName
    && a.userName === b.userName
    && a.password === b.password
    && (a.clientName || '') === (b.clientName || '');
}

function connect(config) {
  if (session && sameConn(active, config)) return Promise.resolve();
  if (connecting) return connecting;
  init();

  if (session && !sameConn(active, config)) {
    try { session.disconnect(); } catch (_) {}
    session = null;
    active = null;
  }

  connecting = new Promise((resolve, reject) => {
    const sessionProps = {
      url: config.url,
      vpnName: config.vpnName,
      userName: config.userName,
      password: config.password,
      publisherProperties: { enabled: true, acknowledgeMode: solace.MessagePublisherAcknowledgeMode.PER_MESSAGE },
    };
    if (config.clientName && config.clientName.trim()) {
      sessionProps.clientName = config.clientName.trim();
    }
    const s = solace.SolclientFactory.createSession(sessionProps);

    s.on(solace.SessionEventCode.UP_NOTICE, () => {
      session = s;
      active = { ...config };
      connecting = null;
      resolve();
    });
    s.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (e) => {
      connecting = null;
      session = null;
      active = null;
      reject(new Error(e?.infoStr || String(e)));
    });
    s.on(solace.SessionEventCode.DISCONNECTED, () => {
      session = null;
      active = null;
      for (const [, p] of pending) p.reject(new Error('Session disconnected'));
      pending.clear();
    });
    s.on(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE, (event) => {
      const id = event?.correlationKey;
      const p = id && pending.get(id);
      if (p) { clearTimeout(p.timer); pending.delete(id); p.resolve(); }
    });
    s.on(solace.SessionEventCode.REJECTED_MESSAGE_ERROR, (event) => {
      const id = event?.correlationKey;
      const p = id && pending.get(id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(id);
        p.reject(new Error(event?.infoStr || 'Message rejected by broker'));
      }
    });

    try { s.connect(); } catch (e) {
      connecting = null;
      reject(e);
    }
  });

  return connecting;
}

async function publish(config, opts) {
  const { destinationType, destinationName, body, deliveryMode } = opts;
  if (destinationType !== 'topic' && destinationType !== 'queue') {
    throw new Error("destinationType must be 'topic' or 'queue'");
  }
  if (!destinationName || !destinationName.trim()) {
    throw new Error('destinationName is required');
  }

  await connect(config);

  const message = solace.SolclientFactory.createMessage();
  const dest = destinationType === 'queue'
    ? solace.SolclientFactory.createDurableQueueDestination(destinationName.trim())
    : solace.SolclientFactory.createTopicDestination(destinationName.trim());
  message.setDestination(dest);

  const payload = body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body));
  message.setBinaryAttachment(payload);

  const mode = deliveryMode === 'direct'
    ? solace.MessageDeliveryModeType.DIRECT
    : solace.MessageDeliveryModeType.PERSISTENT;
  message.setDeliveryMode(mode);

  if (mode === solace.MessageDeliveryModeType.DIRECT) {
    session.send(message);
    return { acknowledged: false, destinationType, destinationName: destinationName.trim(), bytes: payload.length };
  }

  const correlationId = `pub-${++correlationCounter}-${Date.now()}`;
  message.setCorrelationKey(correlationId);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.has(correlationId)) {
        pending.delete(correlationId);
        reject(new Error(`Publish ack timeout after ${ACK_TIMEOUT_MS}ms`));
      }
    }, ACK_TIMEOUT_MS);
    pending.set(correlationId, {
      resolve: () => resolve({ acknowledged: true, destinationType, destinationName: destinationName.trim(), bytes: payload.length }),
      reject,
      timer,
    });
    try {
      session.send(message);
    } catch (e) {
      clearTimeout(timer);
      pending.delete(correlationId);
      reject(e);
    }
  });
}

async function disconnect() {
  try { session?.disconnect(); } catch (_) {}
  session = null;
  active = null;
  for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error('Publisher disconnected')); }
  pending.clear();
}

function status() {
  return { connected: !!session, pendingAcks: pending.size, config: active };
}

module.exports = { publish, disconnect, status };
