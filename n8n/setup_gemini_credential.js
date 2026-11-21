const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

const tmp = path.resolve(__dirname, '_gemini_cred.tmp.json');
const cred = [{
  id: 'gemini0apikey0001',
  name: 'Gemini API Key',
  type: 'httpHeaderAuth',
  data: { name: 'x-goog-api-key', value: process.env.GEMINI_API_KEY },
}];
try {
  fs.writeFileSync(tmp, JSON.stringify(cred), 'utf8');
  execSync(`docker cp "${tmp}" n8n:/tmp/gemini_cred.json`, { stdio: 'inherit' });
  execSync('docker exec n8n n8n import:credentials --input=/tmp/gemini_cred.json', { stdio: 'inherit' });
} finally {
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  try { execSync('docker exec n8n rm -f /tmp/gemini_cred.json'); } catch (e) { /* noop */ }
}
console.log('Credencial Gemini API Key importada (archivo temporal eliminado).');
