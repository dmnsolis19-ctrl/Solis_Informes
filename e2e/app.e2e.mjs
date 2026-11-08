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

test('el Planner lista las visitas generadas de un plan por urgencia', async () => {
  const {context, page} = await newPage();
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await createCompany(page);
  await page.evaluate(async () => {
    const db = await import('/js/store.js'), {newCatalog} = await import('/js/catalogs.js'), {addDays} = await import('/js/planner.js'), {localDate} = await import('/js/domain.js');
    const companyId = (await db.all('companies'))[0].id, today = localDate();
    const customer = Object.assign(newCatalog('customers', companyId), {name: 'Cliente Planner'}); await db.saveEntity('customers', customer);
    const asset = Object.assign(newCatalog('equipment', companyId), {name: 'Equipo Planner', tag: 'EQ-1', customerId: customer.id}); await db.saveEntity('equipment', asset);
    const plan = (name, anchorDate) => Object.assign(newCatalog('workOrders', companyId), {name, type: 'Plan de mantenimiento', customerId: customer.id, equipmentId: asset.id, anchorDate, dueDate: anchorDate, intervalDays: '30', status: 'Planificada', planState: 'Activo'});
    await db.saveEntity('workOrders', plan('Plan futuro', addDays(today, -20)));
    await db.saveEntity('workOrders', plan('Plan hoy', today));
    await db.saveEntity('workOrders', Object.assign(newCatalog('workOrders', companyId), {name: 'Visita atrasada', type: 'Orden de trabajo', planId: 'plan-antiguo', customerId: customer.id, equipmentId: asset.id, dueDate: addDays(today, -3), status: 'Planificada'}));
  });
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  for (const title of ['Vencidos', 'Hoy', 'Esta semana', 'Próximos 30 días']) await page.waitForSelector(`h2:text-is("${title}")`);
  const section = title => page.locator('.planner-section', {has: page.locator(`h2:text-is("${title}")`)});
  await section('Hoy').locator('text=Plan hoy').waitFor();
  await section('Vencidos').locator('text=Visita atrasada').waitFor();
  await section('Próximos 30 días').locator('text=Plan futuro').waitFor();
  assert.ok(await section('Hoy').locator('.pill', {hasText: 'Sin técnico'}).count() > 0);
  await page.selectOption('[data-ops-filter="equipmentId"]', {label: 'EQ-1 · Equipo Planner'});
  await section('Hoy').locator('text=Plan hoy').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('crear un plan para dos equipos desde el diálogo genera sus visitas', async () => {
  const {context, page} = await newPage();
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await createCompany(page);
  await page.evaluate(async () => {
    const db = await import('/js/store.js'), {newCatalog} = await import('/js/catalogs.js');
    const companyId = (await db.all('companies'))[0].id;
    for (const [tag, name] of [['EQ-A', 'Bomba A'], ['EQ-B', 'Bomba B']]) await db.saveEntity('equipment', Object.assign(newCatalog('equipment', companyId), {name, tag}));
  });
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.getByRole('button', {name: 'Crear plan'}).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre del plan').fill('Mantención mensual');
  await dialog.getByLabel('Periodicidad (días)').fill('30');
  await dialog.getByRole('button', {name: 'Crear plan'}).click();
  await dialog.getByText('Selecciona al menos un equipo.').waitFor();
  await dialog.getByLabel('EQ-A · Bomba A').check();
  await dialog.getByLabel('EQ-B · Bomba B').check();
  await dialog.getByRole('button', {name: 'Crear plan'}).click();
  await page.locator('[data-planner-visit]', {hasText: 'Mantención mensual · EQ-A'}).first().waitFor();
  await page.locator('[data-planner-visit]', {hasText: 'Mantención mensual · EQ-B'}).first().waitFor();
  assert.equal(await page.locator('[data-planner-plan]').count(), 2);
  const before = await page.locator('[data-planner-visit]').count();
  await page.locator('[data-planner-plan]').first().getByRole('button', {name: 'Editar plan'}).click();
  await page.getByRole('dialog').getByLabel('Periodicidad (días)').fill('10');
  await page.getByRole('dialog').getByRole('button', {name: 'Guardar plan'}).click();
  await page.waitForFunction(n => document.querySelectorAll('[data-planner-visit]').length > n, before);
  await page.locator('[data-planner-plan]').first().getByRole('button', {name: 'Pausar plan'}).click();
  await page.locator('.notice', {hasText: 'pausado'}).waitFor();
  assert.deepEqual(page.errors, []);
  await context.close();
});
