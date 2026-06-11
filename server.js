const fs = require('fs');
const path = require('path');
const express = require('express');
const consumer = require('./lib/consumer');
const publisher = require('./lib/publisher');

const DEFAULTS = {
  url: process.env.SOLACE_URL || 'wss://mr-connection-1c0tnfngsuh.messaging.solace.cloud:443',
  vpnName: process.env.SOLACE_VPN || 'nazan-dev',
  userName: process.env.SOLACE_USER || 'solace-cloud-client',
  password: process.env.SOLACE_PASSWORD || 'mqgilttpdjkqi8l5q19ur490qh',
  clientName: process.env.SOLACE_CLIENT_NAME || 'Nazanone.OrdenesTesting.Consumer',
  queueName: process.env.SOLACE_QUEUE || 'NAZAN.STOREFRONT.ECOMMERCE.ORDER.CREATED.PERSISTER.V1',
  autoAck: process.env.SOLACE_AUTO_ACK === 'true',
};

const SAVE_DIR = path.join(__dirname, 'received');
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const sseClients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) {}
  }
}

app.get('/defaults', (_req, res) => {
  res.json(DEFAULTS);
});

app.get('/HELP.json', (_req, res) => {
  res.sendFile(path.join(__dirname, 'HELP.json'));
});

app.get('/status', (_req, res) => {
  res.json(consumer.status());
});

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify(consumer.status())}\n\n`);
  sseClients.add(res);
  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 25000);
  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.delete(res);
  });
});

app.post('/start', (req, res) => {
  if (consumer.status().running) {
    return res.status(409).json({ error: 'Consumer already running' });
  }
  const cfg = {
    url: req.body.url,
    vpnName: req.body.vpnName,
    userName: req.body.userName,
    password: req.body.password,
    clientName: req.body.clientName,
    queueName: req.body.queueName,
    autoAck: !!req.body.autoAck,
  };
  for (const k of ['url', 'vpnName', 'userName', 'password', 'queueName']) {
    if (!cfg[k]) return res.status(400).json({ error: `Missing field: ${k}` });
  }
  try {
    consumer.start(cfg, {
      onStatus: (s) => broadcast('status', s),
      onError: (e) => broadcast('err', e),
      onMessage: (m) => {
        broadcast('msg', m);
        const safeId = m.id.replace(/[^A-Za-z0-9_-]/g, '_');
        const file = path.join(SAVE_DIR, `${m.time.replace(/[:.]/g, '-')}_${safeId}.json`);
        fs.writeFile(file, m.body, () => {});
      },
    });
    broadcast('status', { phase: 'connecting', url: cfg.url, queue: cfg.queueName });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/stop', async (_req, res) => {
  await consumer.stop();
  res.json({ ok: true });
});

app.post('/publish', async (req, res) => {
  const conn = {
    url: req.body.url,
    vpnName: req.body.vpnName,
    userName: req.body.userName,
    password: req.body.password,
    clientName: req.body.clientName,
  };
  for (const k of ['url', 'vpnName', 'userName', 'password']) {
    if (!conn[k]) return res.status(400).json({ error: `Missing field: ${k}` });
  }
  const destinationType = req.body.destinationType;
  const destinationName = req.body.destinationName;
  if (destinationType !== 'topic' && destinationType !== 'queue') {
    return res.status(400).json({ error: "destinationType must be 'topic' or 'queue'" });
  }
  if (!destinationName || !String(destinationName).trim()) {
    return res.status(400).json({ error: 'Missing field: destinationName' });
  }
  try {
    const result = await publisher.publish(conn, {
      destinationType,
      destinationName: String(destinationName),
      body: req.body.body ?? '',
      deliveryMode: req.body.deliveryMode === 'direct' ? 'direct' : 'persistent',
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/publisher/status', (_req, res) => {
  res.json(publisher.status());
});

app.post('/publisher/disconnect', async (_req, res) => {
  await publisher.disconnect();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Solace consumer UI running at http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await consumer.stop();
  await publisher.disconnect();
  process.exit(0);
});
