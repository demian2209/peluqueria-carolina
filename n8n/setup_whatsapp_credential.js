const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

const token = process.env.WHATSAPP_ACCESS_TOKEN;
if (!token) {
  console.error('❌ Error: WHATSAPP_ACCESS_TOKEN no encontrado en backend/.env');
  process.exit(1);
}

const tmp = path.resolve(__dirname, '_whatsapp_cred.tmp.json');
const cred = [{
  id: 'whatsapp0token0001',
  name: 'WhatsApp Cloud API Token',
  type: 'httpHeaderAuth',
  data: {
    name: 'Authorization',
    value: `Bearer ${token}`,
  },
}];

try {
  fs.writeFileSync(tmp, JSON.stringify(cred), 'utf8');
  execSync(`docker cp "${tmp}" n8n:/tmp/whatsapp_cred.json`, { stdio: 'inherit' });
  execSync('docker exec n8n n8n import:credentials --input=/tmp/whatsapp_cred.json', { stdio: 'inherit' });
} finally {
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  try {
    execSync('docker exec n8n rm -f /tmp/whatsapp_cred.json');
  } catch (e) {
    /* noop */
  }
}

console.log('✅ Credencial WhatsApp Cloud API Token cifrada e importada en n8n.');
