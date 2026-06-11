const fs = require('fs');
const path = require('path');
const consumer = require('./lib/consumer');

const CONFIG = {
  url: process.env.SOLACE_URL || 'wss://mr-connection-1c0tnfngsuh.messaging.solace.cloud:443',
  vpnName: process.env.SOLACE_VPN || 'nazan-dev',
  userName: process.env.SOLACE_USER || 'solace-cloud-client',
  password: process.env.SOLACE_PASSWORD || 'mqgilttpdjkqi8l5q19ur490qh',
  clientName: process.env.SOLACE_CLIENT_NAME || 'Nazanone.OrdenesTesting.Consumer',
  queueName: process.argv[2] || process.env.SOLACE_QUEUE || 'NAZAN.STOREFRONT.ECOMMERCE.ORDER.CREATED.PERSISTER.V1',
  autoAck: process.env.SOLACE_AUTO_ACK === 'true',
};

const SAVE_DIR = process.env.SOLACE_SAVE_DIR || path.join(__dirname, 'received');
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

consumer.start(CONFIG, {
  onStatus: (s) => {
    if (s.phase === 'session-up') console.log(`[session] connected (vpn=${s.vpn})`);
    else if (s.phase === 'bound') console.log(`[consumer] bound to '${s.queue}' — waiting (Ctrl+C to stop)`);
    else if (s.phase === 'stopped') console.log('[session] stopped');
  },
  onError: (e) => console.error(`[error/${e.where}] ${e.message}`),
  onMessage: (m) => {
    console.log('---');
    console.log(`[msg] id=${m.id} topic=${m.topic} time=${m.time}`);
    console.log(m.body.length > 800 ? m.body.slice(0, 800) + ` ... (+${m.body.length - 800} chars)` : m.body);
    const safeId = m.id.replace(/[^A-Za-z0-9_-]/g, '_');
    fs.writeFileSync(path.join(SAVE_DIR, `${m.time.replace(/[:.]/g, '-')}_${safeId}.json`), m.body);
  },
});

process.on('SIGINT', async () => {
  console.log('\n[shutdown] disconnecting...');
  await consumer.stop();
  setTimeout(() => process.exit(0), 500);
});
