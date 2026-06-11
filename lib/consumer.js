const solace = require('solclientjs').debug;

let initialized = false;
function init() {
  if (initialized) return;
  solace.SolclientFactory.init({ profile: solace.SolclientFactoryProfiles.version10 });
  solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
  initialized = true;
}

let session = null;
let consumer = null;
let active = null;

function start(config, handlers) {
  if (session) throw new Error('Consumer already running. Stop first.');
  init();

  active = { ...config };
  const sessionProps = {
    url: config.url,
    vpnName: config.vpnName,
    userName: config.userName,
    password: config.password,
  };
  if (config.clientName && config.clientName.trim()) {
    sessionProps.clientName = config.clientName.trim();
  }
  session = solace.SolclientFactory.createSession(sessionProps);

  session.on(solace.SessionEventCode.UP_NOTICE, () => {
    handlers.onStatus?.({ phase: 'session-up', url: config.url, vpn: config.vpnName });
    bindConsumer(config, handlers);
  });

  session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (e) => {
    handlers.onError?.({ where: 'session', message: e?.infoStr || String(e) });
    cleanup();
    handlers.onStatus?.({ phase: 'stopped' });
  });

  session.on(solace.SessionEventCode.DISCONNECTED, () => {
    cleanup();
    handlers.onStatus?.({ phase: 'stopped' });
  });

  session.connect();
}

function bindConsumer(config, handlers) {
  consumer = session.createMessageConsumer({
    queueDescriptor: { name: config.queueName, type: solace.QueueType.QUEUE },
    acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT,
    createIfMissing: false,
  });

  consumer.on(solace.MessageConsumerEventName.UP, () => {
    handlers.onStatus?.({ phase: 'bound', queue: config.queueName });
  });

  consumer.on(solace.MessageConsumerEventName.CONNECT_FAILED_ERROR, (e) => {
    handlers.onError?.({ where: 'consumer', message: e?.infoStr || String(e) });
  });

  consumer.on(solace.MessageConsumerEventName.MESSAGE, (message) => {
    const id = message.getGuaranteedMessageId() || Date.now();
    const bin = message.getBinaryAttachment();
    const body = bin
      ? (Buffer.isBuffer(bin) ? bin.toString('utf8') : String(bin))
      : (message.getXmlContent() || '');
    const dest = message.getDestination?.();
    const topic = dest?.getName?.() || '';

    handlers.onMessage?.({
      id: String(id),
      topic,
      time: new Date().toISOString(),
      body,
    });

    if (config.autoAck) {
      try { message.acknowledge(); } catch (_) {}
    }
  });

  consumer.connect();
}

async function stop() {
  try { consumer?.disconnect(); } catch (_) {}
  try { session?.disconnect(); } catch (_) {}
}

function cleanup() {
  consumer = null;
  session = null;
  active = null;
}

function status() {
  return { running: !!session, config: active };
}

module.exports = { start, stop, status };
