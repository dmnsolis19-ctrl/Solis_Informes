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
  await dialog.getByRole('button', {name: 'Crear plan'}).dblclick();
  await page.locator('[data-planner-visit]', {hasText: 'Mantención mensual · EQ-A'}).first().waitFor();
  await page.locator('[data-planner-visit]', {hasText: 'Mantención mensual · EQ-B'}).first().waitFor();
  const state = () => page.evaluate(async () => {
    const db = await import('/js/store.js'), {addDays} = await import('/js/planner.js'), {localDate} = await import('/js/domain.js');
    const rows = await db.all('workOrders'), today = localDate(), out = {today};
    for (const t of ['EQ-A', 'EQ-B']) {
      const plan = rows.find(r => r.type === 'Plan de mantenimiento' && r.name.endsWith(t)), vs = rows.filter(r => r.planId === plan?.id);
      out[t] = {plans: rows.filter(r => r.type === 'Plan de mantenimiento' && r.name.endsWith(t)).length, planned: vs.filter(v => v.status === 'Planificada').map(v => v.dueDate).sort(), cancelled: vs.filter(v => v.status === 'Cancelada').map(v => [v.dueDate, v.closedReason]).sort(), interval: plan?.intervalDays, planState: plan?.planState};
    }
    return out;
  });
  const grid = (today, n) => page.evaluate(async ([t, n]) => { const {addDays} = await import('/js/planner.js'); const o = []; for (let d = 0; d <= 90; d += n) o.push(addDays(t, d)); return o; }, [today, n]);
  let st = await state();
  assert.equal(st['EQ-A'].plans, 1); assert.equal(st['EQ-B'].plans, 1);
  assert.deepEqual(st['EQ-A'].planned, await grid(st.today, 30));
  const card = page.locator('[data-planner-plan]', {hasText: 'EQ-A'});
  const g30 = await grid(st.today, 30), busy = g30[1];
  // Otro dispositivo inicia una visita después de cargar la pantalla: no debe cancelarse.
  await page.evaluate(async ([date]) => {
    const db = await import('/js/store.js'), v = (await db.all('workOrders')).find(r => r.planId && r.name.endsWith('EQ-A') && r.dueDate === date);
    await db.saveEntity('workOrders', {...v, status: 'En curso'});
  }, [busy]);
  await card.getByRole('button', {name: 'Editar plan'}).click();
  await page.getByRole('dialog').getByLabel('Periodicidad (días)').fill('7');
  await page.getByRole('dialog').getByRole('button', {name: 'Guardar plan'}).click();
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
  await page.locator('#toast', {hasText: '1 visita no se canceló porque cambió en otro dispositivo'}).waitFor();
  st = await state();
  const g7 = await grid(st.today, 7);
  assert.equal(await page.evaluate(async d => (await (await import('/js/store.js')).all('workOrders')).find(r => r.planId && r.name.endsWith('EQ-A') && r.dueDate === d).status, busy), 'En curso');
  assert.deepEqual(st['EQ-A'].planned, g7);
  assert.equal(new Set(st['EQ-A'].planned).size, st['EQ-A'].planned.length);
  assert.deepEqual(st['EQ-A'].cancelled, g30.filter(d => !g7.includes(d) && d !== busy).map(d => [d, 'calendario corrido']));
  assert.equal((await state())['EQ-B'].interval, '30');
  await card.getByRole('button', {name: 'Pausar plan'}).click();
  await page.locator('.notice', {hasText: 'pausado'}).waitFor();
  await card.getByRole('button', {name: 'Editar plan'}).click();
  await page.getByRole('dialog').getByLabel('Periodicidad (días)').fill('10');
  await page.getByRole('dialog').getByRole('button', {name: 'Guardar plan'}).click();
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
  assert.deepEqual((await state())['EQ-A'].planned, g7);
  await card.getByRole('button', {name: 'Reanudar plan'}).click();
  await card.getByRole('button', {name: 'Pausar plan'}).waitFor();
  st = await state();
  assert.equal(st['EQ-A'].planState, 'Activo');
  assert.deepEqual(st['EQ-A'].planned, (await grid(st.today, 10)).filter(d => d !== busy));
  assert.ok(st['EQ-A'].cancelled.every(([, r]) => r === 'calendario corrido'));
  await card.getByRole('button', {name: 'Pausar plan'}).click();
  assert.deepEqual(page.errors, []);
  await context.close();
});

const until = async (page, fn, arg) => { for (let i = 0; i < 100; i++) { if (await page.evaluate(fn, arg)) return; await page.waitForTimeout(100); } throw new Error('Condición no cumplida a tiempo: ' + fn); };
async function plannerFixture(page) {
  await page.evaluate(async () => {
    const db = await import('/js/store.js'), {newCatalog} = await import('/js/catalogs.js'), {localDate} = await import('/js/domain.js');
    const companyId = (await db.all('companies'))[0].id, today = localDate();
    const customer = Object.assign(newCatalog('customers', companyId), {name: 'Cliente Visita'}); await db.saveEntity('customers', customer);
    const site = Object.assign(newCatalog('sites', companyId), {name: 'Planta Visita', customerId: customer.id}); await db.saveEntity('sites', site);
    const asset = Object.assign(newCatalog('equipment', companyId), {name: 'Bomba Visita', tag: 'EQ-V', customerId: customer.id, siteId: site.id}); await db.saveEntity('equipment', asset);
    await db.saveEntity('workOrders', Object.assign(newCatalog('workOrders', companyId), {name: 'Plan visita', type: 'Plan de mantenimiento', customerId: customer.id, siteId: site.id, equipmentId: asset.id, anchorDate: today, dueDate: today, intervalDays: '30', status: 'Planificada', planState: 'Activo', scope: 'Revisar sellos', reportTemplate: 'general'}));
  });
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('[data-planner-visit]').first().waitFor();
}
const visitRows = page => page.evaluate(async () => { const db = await import('/js/store.js'); return (await db.all('workOrders')).filter(r => r.planId).map(r => ({id: r.id, type: r.type, status: r.status, dueDate: r.dueDate, reportId: r.reportId, closedReason: r.closedReason})).sort((a, b) => a.dueDate < b.dueDate ? -1 : 1); });
const gotoPlanner = async page => { await page.reload({waitUntil: 'networkidle'}); await page.locator('nav').getByText('Planner', {exact: true}).click(); };

test('cerrar una visita atrasada corriendo el calendario', async () => {
  const {context, page} = await newPage();
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await createCompany(page);
  await plannerFixture(page);
  const today = await page.evaluate(async () => (await import('/js/domain.js')).localDate());
  const add = (d, n) => page.evaluate(async ([d, n]) => (await import('/js/planner.js')).addDays(d, n), [d, n]);
  // La primera visita (hoy) pasa a estar programada hace 4 días.
  await page.evaluate(async () => { const db = await import('/js/store.js'), {addDays} = await import('/js/planner.js'), {localDate} = await import('/js/domain.js'); const v = (await db.all('workOrders')).filter(r => r.planId).sort((a, b) => a.dueDate < b.dueDate ? -1 : 1)[0]; await db.saveEntity('workOrders', {...v, dueDate: addDays(localDate(), -4)}); });
  await gotoPlanner(page);
  const card = page.locator('[data-planner-visit]', {hasText: 'Plan visita'}).first();
  await card.getByRole('button', {name: 'Iniciar visita'}).click();
  await until(page, async () => (await (await import('/js/store.js')).all('workOrders')).some(r => r.planId && r.status === 'En curso' && r.reportId));
  const started = await page.evaluate(async () => { const db = await import('/js/store.js'), v = (await db.all('workOrders')).find(r => r.status === 'En curso'), rep = (await db.all('reports')).filter(r => r.id === v.reportId); return {n: (await db.all('reports')).length, linked: rep.length, scope: rep[0]?.scope, template: rep[0]?.template, equipmentRef: rep[0]?.equipmentRef}; });
  assert.equal(started.n, 1); assert.equal(started.linked, 1); assert.equal(started.scope, 'Revisar sellos'); assert.equal(started.template, 'general');
  const done = await add(today, -1);
  await gotoPlanner(page);
  await page.locator('[data-planner-visit]', {hasText: 'Plan visita'}).first().getByRole('button', {name: 'Abrir informe'}).waitFor();
  assert.equal(await page.evaluate(async () => (await (await import('/js/store.js')).all('reports')).length), 1);
  await page.evaluate(async d => { const db = await import('/js/store.js'), r = (await db.all('reports'))[0]; await db.saveEntity('reports', {...r, status: 'Emitido', serviceDate: d}); }, done);
  await gotoPlanner(page);
  const dialog = page.getByRole('dialog', {name: 'Esta visita se hizo con retraso'});
  await dialog.waitFor();
  await dialog.getByText(/Informe .*programada para el .*realizada el/).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Mantener calendario');
  await page.keyboard.press('Escape');
  await dialog.waitFor({state: 'detached'});
  assert.equal((await visitRows(page)).filter(v => v.status === 'En curso').length, 1);
  await gotoPlanner(page);
  await dialog.waitFor();
  await dialog.getByRole('button', {name: 'Correr calendario desde esta visita'}).click();
  await until(page, async () => (await (await import('/js/store.js')).all('workOrders')).some(r => r.planId && r.status === 'Completada'));
  await until(page, async () => (await (await import('/js/store.js')).all('workOrders')).filter(r => r.planId && r.status === 'Planificada').length === 3);
  const rows = await visitRows(page), live = rows.filter(v => v.status === 'Planificada').map(v => v.dueDate);
  assert.deepEqual(live, [await add(done, 30), await add(done, 60), await add(done, 90)]);
  assert.equal(rows.filter(v => v.status === 'Completada').length, 1);
  assert.deepEqual(rows.filter(v => v.status === 'Cancelada').map(v => [v.dueDate, v.closedReason]), [[await add(today, 30), 'calendario corrido'], [await add(today, 60), 'calendario corrido'], [await add(today, 90), 'calendario corrido']]);
  assert.equal(new Set(rows.map(v => v.id)).size, rows.length);
  const plan = await page.evaluate(async () => (await (await import('/js/store.js')).all('workOrders')).find(r => r.type === 'Plan de mantenimiento'));
  assert.equal(plan.anchorDate, done); assert.equal(JSON.parse(plan.anchorHistory).length, 1);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('una visita hecha a tiempo se cierra sola y conserva el calendario', async () => {
  const {context, page} = await newPage();
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await createCompany(page);
  await plannerFixture(page);
  const before = (await visitRows(page)).map(v => v.dueDate);
  await page.locator('[data-planner-visit]').first().getByRole('button', {name: 'Iniciar visita'}).click();
  await until(page, async () => (await (await import('/js/store.js')).all('workOrders')).some(r => r.planId && r.status === 'En curso' && r.reportId));
  await gotoPlanner(page);
  await page.evaluate(async () => { const db = await import('/js/store.js'), r = (await db.all('reports'))[0]; await db.saveEntity('reports', {...r, status: 'Emitido'}); });
  await gotoPlanner(page);
  await until(page, async () => (await (await import('/js/store.js')).all('workOrders')).some(r => r.planId && r.status === 'Completada'));
  assert.equal(await page.getByRole('dialog').count(), 0);
  const rows = await visitRows(page);
  assert.deepEqual(rows.map(v => v.dueDate), before);
  assert.deepEqual(rows.map(v => v.status), ['Completada', 'Planificada', 'Planificada', 'Planificada']);
  assert.equal(new Set(rows.map(v => v.id)).size, rows.length);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('doble clic en Iniciar visita crea un solo informe', async () => {
  const {context, page} = await newPage();
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await createCompany(page);
  await plannerFixture(page);
  await page.locator('[data-planner-visit]').first().getByRole('button', {name: 'Iniciar visita'}).dblclick();
  await until(page, async () => (await (await import('/js/store.js')).all('workOrders')).some(r => r.planId && r.status === 'En curso' && r.reportId));
  await page.waitForTimeout(800);
  const out = await page.evaluate(async () => { const db = await import('/js/store.js'), reps = await db.all('reports'), v = (await db.all('workOrders')).filter(r => r.planId && r.status === 'En curso'); return {reports: reps.filter(r => r.equipmentRef).length, visits: v.length, same: v[0]?.reportId === reps[0]?.id}; });
  assert.equal(out.reports, 1); assert.equal(out.visits, 1); assert.equal(out.same, true);
  assert.deepEqual(page.errors, []);
  await context.close();
});
