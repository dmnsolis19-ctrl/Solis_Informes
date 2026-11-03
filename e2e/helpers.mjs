// Utilidades para las pruebas de extremo a extremo (navegador real). Requieren Playwright:
//   npm i --no-save playwright && npx playwright install chromium
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SETUP_TOKEN = 'e2e-installation-token-2026';

export async function loadPlaywright() {
  try { return await import('playwright'); } catch { throw new Error('Falta Playwright. Instala con: npm i --no-save playwright && npx playwright install chromium'); }
}
const freePort = () => new Promise((resolve, reject) => { const s = net.createServer(); s.listen(0, () => { const {port} = s.address(); s.close(() => resolve(port)); }); s.on('error', reject); });

/** Inicia el servidor local con datos temporales y devuelve {url, stop, dir}. */
export async function startServer() {
  const port = await freePort(), dir = mkdtempSync(path.join(tmpdir(), 'solis-e2e-'));
  const child = spawn(process.execPath, ['scripts/dev.mjs'], {cwd: root, env: {...process.env, PORT: String(port), DATA_DIR: dir, SETUP_TOKEN}, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '';
  child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(url + '/api/status')).ok) break; } catch {}
    if (child.exitCode !== null) throw new Error('El servidor no inició: ' + output);
    await new Promise(r => setTimeout(r, 150));
  }
  return {url, dir, stop() { child.kill(); rmSync(dir, {recursive: true, force: true}); }};
}

export const sampleCsv = path => writeFileSync(path, 'Timestamp;SOC (%);Potencia FV (kW)\n2026-10-01 08:00:00;55,0;0,0\n2026-10-01 09:00:00;58,5;2,0\n2026-10-01 10:00:00;64,0;4,0\n2026-10-01 11:00:00;70,5;4,0\n2026-10-01 12:00:00;72,0;3,0\n');

export async function createCompany(page, name = 'Empresa E2E SpA') {
  await page.getByText('Empresas y marca').first().click();
  await page.fill('[data-field="name"]', name);
  await page.getByText('Guardar empresa').click();
  await page.waitForTimeout(400);
}
