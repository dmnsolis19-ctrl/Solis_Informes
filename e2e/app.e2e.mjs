import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadPlaywright, startServer, sampleCsv, createCompany, SETUP_TOKEN} from './helpers.mjs';
import {totpCode, base32Decode} from '../worker/totp.js';

let server, browser;
before(async () => { const {chromium} = await loadPlaywright(); server = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); server?.stop(); });
const newPage = async (options = {}) => { const context = await browser.newContext({viewport: {width: 1280, height: 1000}, ...options}), page = await context.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(e.message)); return {context, page}; };

test('la aplicación se abre sin conexión después de la primera visita', async () => {
  const {context, page} = await newPage();
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({waitUntil: 'networkidle'});
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('text=Vista general');
  assert.match(await page.title(), /SOLIS Field/);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('importar un CSV crea gráficos que aparecen en la vista previa del documento', async () => {
  const {context, page} = await newPage();
  const csv = path.join(mkdtempSync(path.join(tmpdir(), 'csv-')), 'energia.csv');
  sampleCsv(csv);
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await createCompany(page);
  await page.getByText('Nuevo informe').first().click();
  await page.getByText('Almacenamiento con baterías y gestión de energía').click();
  await page.locator('button').filter({hasText: 'Mediciones'}).first().click();
  await page.getByText('Importar datos (CSV)').click();
  await page.setInputFiles('#csv-file', csv);
  await page.waitForSelector('#csv-time');
  await page.fill('#csv-tz', 'America/Santiago');
  await page.getByText('Agregar gráficos').click();
  await page.waitForSelector('text=Gráfico 2');
  await page.locator('button', {hasText: 'Vista previa'}).first().click();
  const frame = page.frameLocator('#report-preview');
  await frame.locator('.doc-chart').first().waitFor();
  assert.equal(await frame.locator('.doc-chart').count(), 2);
  assert.match(await frame.locator('.doc-chart-stats').first().innerText(), /72 %/);
  assert.match(await frame.locator('.doc-chart .doc-note').nth(1).innerText(), /11,5 kWh/);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('la verificación en dos pasos se activa y se exige al iniciar sesión', async () => {
  const {context, page} = await newPage();
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await page.getByText('Sincronización').first().click();
  await page.fill('#login-email', 'admin@e2e.test'); await page.fill('#login-password', 'e2e-password-12345');
  await page.locator('summary', {hasText: 'Primer acceso'}).click();
  await page.fill('#setup-token', SETUP_TOKEN);
  await page.getByText('Conectar dispositivo').click();
  await page.waitForSelector('text=Cerrar sesión');
  await page.getByText('Verificación en dos pasos').click();
  await page.getByText('Comenzar').click();
  const secret = (await page.locator('.modal code').innerText()).replaceAll(' ', '');
  await page.fill('#twofa-code', await totpCode(base32Decode(secret)));
  await page.locator('button', {hasText: 'Activar'}).click();
  await page.waitForSelector('.recovery-codes');
  assert.equal((await page.locator('.recovery-codes').innerText()).trim().split(/\s+/).length, 8);
  await page.getByText('Ya los guardé').click();
  await page.getByText('Cerrar sesión').click();
  await page.getByText('Sincronización').first().click();
  await page.fill('#login-email', 'admin@e2e.test'); await page.fill('#login-password', 'e2e-password-12345');
  assert.equal(await page.locator('#login-code-field').isHidden(), true);
  await page.getByText('Conectar dispositivo').click();
  await page.locator('#login-code-field').waitFor({state: 'visible'});
  await page.fill('#login-code', await totpCode(base32Decode(secret), Date.now() + 30000));
  await page.getByText('Conectar dispositivo').click();
  await page.waitForSelector('text=Cerrar sesión');
  await context.close();
});

test('las plantillas nuevas aparecen por especialidad y crean informes válidos', async () => {
  const {context, page} = await newPage();
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await createCompany(page);
  await page.getByText('Plantillas').first().click();
  await page.selectOption('#template-group', 'water');
  await page.waitForSelector('text=Planta de tratamiento de agua (PTAP)');
  await page.getByText('Planta de tratamiento de agua (PTAP)').first().click();
  await page.waitForSelector('text=PLANTA DE AGUA');
  assert.match(await page.locator('#content').innerText(), /AG-2026-\d{4}/);
  assert.deepEqual(page.errors, []);
  await context.close();
});
