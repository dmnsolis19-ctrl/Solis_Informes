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
  const boxes = await dialog.locator('input[name=equipmentIds]').evaluateAll(list => list.map(i => { const r = i.getBoundingClientRect(), t = i.nextElementSibling.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height), gap: Math.round(t.left - r.right), label: i.nextElementSibling.textContent.trim()}; }));
  assert.deepEqual(boxes.map(b => b.label), ['EQ-A · Bomba A', 'EQ-B · Bomba B'], 'los equipos se listan ordenados por TAG');
  for (const b of boxes) assert.ok(b.w <= 24 && b.h <= 24 && b.gap <= 16, 'cada cuadro de selección es pequeño y está junto a su nombre: ' + JSON.stringify(b));
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

// Calendario del Planner: un plan lejano (no genera visitas) y visitas sembradas en fechas conocidas.
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
async function calendarFixture(page) {
  await page.goto(server.url, {waitUntil: 'networkidle'});
  await createCompany(page);
  const dates = await page.evaluate(async () => {
    const db = await import('/js/store.js'), {newCatalog} = await import('/js/catalogs.js'), {addDays} = await import('/js/planner.js'), {localDate} = await import('/js/domain.js');
    const companyId = (await db.all('companies'))[0].id, today = localDate(), now = new Date(), pad = n => String(n).padStart(2, '0');
    const last = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)), next = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 15));
    const customer = Object.assign(newCatalog('customers', companyId), {name: 'Cliente Calendario'}); await db.saveEntity('customers', customer);
    const asset = Object.assign(newCatalog('equipment', companyId), {name: 'Equipo Calendario', tag: 'EQ-CAL', customerId: customer.id}); await db.saveEntity('equipment', asset);
    const plan = Object.assign(newCatalog('workOrders', companyId), {name: 'Plan lejano', type: 'Plan de mantenimiento', customerId: customer.id, equipmentId: asset.id, anchorDate: addDays(today, 400), dueDate: addDays(today, 400), intervalDays: '30', status: 'Planificada', planState: 'Activo'});
    await db.saveEntity('workOrders', plan);
    const visit = (name, dueDate, extra = {}) => db.saveEntity('workOrders', Object.assign(newCatalog('workOrders', companyId), {name, type: 'Orden de trabajo', planId: plan.id, customerId: customer.id, equipmentId: asset.id, dueDate, status: 'Planificada', priority: 'Media'}, extra));
    await visit('Visita A', today); await visit('Visita B', today, {priority: 'Alta'}); await visit('Visita fin de mes', last); await visit('Visita mes siguiente', next);
    await visit('Visita cancelada', today, {status: 'Cancelada'});
    return {today, last, next, year: now.getFullYear(), month: now.getMonth() + 1, pad: pad(now.getMonth() + 1)};
  });
  await page.reload({waitUntil: 'networkidle'});
  return dates;
}
const monthTitle = (year, month) => `${MONTH_NAMES[month - 1]} de ${year}`;

test('el Planner alterna Lista y Calendario y recuerda la elección tras recargar', async () => {
  const {context, page} = await newPage();
  const d = await calendarFixture(page);
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  const pressed = name => page.getByRole('button', {name, exact: true}).getAttribute('aria-pressed');
  await page.locator('[data-planner-visit]').first().waitFor();
  assert.equal(await pressed('Lista'), 'true'); assert.equal(await pressed('Calendario'), 'false');
  assert.equal(await page.locator('.cal-grid').count(), 0);
  await page.getByRole('button', {name: 'Calendario', exact: true}).click();
  await page.locator('.cal-grid').waitFor();
  assert.equal(await pressed('Calendario'), 'true');
  assert.equal(await page.locator('.cal-day').count() % 7, 0);
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('.cal-grid').waitFor();
  assert.equal(await pressed('Calendario'), 'true');
  await page.getByRole('button', {name: 'Lista', exact: true}).click();
  await page.locator('.planner-section h2:text-is("Hoy")').waitFor();
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('[data-planner-visit]').first().waitFor();
  assert.equal(await pressed('Lista'), 'true'); assert.equal(await page.locator('.cal-grid').count(), 0);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('el calendario muestra cada visita en su día, cambia de mes y lista las visitas del día elegido', async () => {
  const {context, page} = await newPage();
  const d = await calendarFixture(page);
  await page.evaluate(() => localStorage.setItem('solis.plannerView', 'calendar'));
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('.cal-grid').waitFor();
  const day = iso => page.locator(`.cal-day[data-date="${iso}"]`);
  await page.getByRole('heading', {name: monthTitle(d.year, d.month), level: 3}).waitFor();
  assert.equal(await page.locator('.cal-day:not(.outside)').count() >= 28, true);
  // Hoy: dos visitas (la cancelada no cuenta), con la de prioridad Alta primero; hoy viene seleccionado.
  await day(d.today).locator('.cal-chip', {hasText: 'Visita B'}).waitFor();
  assert.equal(await day(d.today).locator('.cal-chip').count() >= 2, true);
  assert.equal(await day(d.today).locator('.cal-chip', {hasText: 'Visita cancelada'}).count(), 0);
  assert.equal(await day(d.today).locator('.cal-chip-name').first().textContent(), 'Visita B');
  assert.match(await day(d.today).getAttribute('aria-label'), /\d+ de \w+ de \d{4}, (2|3) visitas, hoy/);
  assert.equal(await day(d.today).getAttribute('aria-pressed'), 'true');
  await day(d.last).locator('.cal-chip', {hasText: 'Visita fin de mes'}).waitFor();
  assert.equal(await page.locator('.cal-chip', {hasText: 'Visita mes siguiente'}).count(), 0, 'la visita del 15 del mes siguiente no está en la cuadrícula de este mes');
  assert.equal(await day(d.next).count(), 0);
  assert.equal(await page.locator('[data-planner-visit]', {hasText: 'Visita B'}).count(), 1);
  // Mes siguiente: aparece la visita del 15, vuelve al mes actual con Hoy.
  await page.getByRole('button', {name: 'Mes siguiente'}).click();
  const next = new Date(d.year, d.month, 1);
  await page.getByRole('heading', {name: monthTitle(next.getFullYear(), next.getMonth() + 1), level: 3}).waitFor();
  await day(d.next).locator('.cal-chip', {hasText: 'Visita mes siguiente'}).waitFor();
  assert.equal(await page.locator('[data-planner-visit]').count(), 0);
  await day(d.next).click();
  await page.locator('[data-planner-visit]', {hasText: 'Visita mes siguiente'}).waitFor();
  assert.equal(await day(d.next).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-planner-visit]').count(), 1);
  await page.locator('[data-planner-visit]').getByRole('button', {name: 'Iniciar visita'}).waitFor();
  await page.locator('[data-planner-visit]').getByRole('button', {name: 'Abrir / editar'}).waitFor();
  await page.getByRole('button', {name: 'Mes anterior'}).click();
  await page.getByRole('heading', {name: monthTitle(d.year, d.month), level: 3}).waitFor();
  await page.getByRole('button', {name: 'Mes anterior'}).click();
  const prev = new Date(d.year, d.month - 2, 1);
  await page.getByRole('heading', {name: monthTitle(prev.getFullYear(), prev.getMonth() + 1), level: 3}).waitFor();
  assert.equal(await page.locator('.cal-day:not(.outside) .cal-chip').count(), 0);
  // Los días vecinos atenuados no quedan vacíos: si hoy cae en el relleno de esa cuadrícula, conserva sus etiquetas.
  if (await day(d.today).count()) { assert.equal(await day(d.today).evaluate(el => el.classList.contains('outside')), true); await day(d.today).locator('.cal-chip', {hasText: 'Visita A'}).waitFor(); }
  await page.getByText('Elige un día para ver sus visitas.').waitFor();
  await page.getByRole('button', {name: 'Hoy', exact: true}).click();
  await page.getByRole('heading', {name: monthTitle(d.year, d.month), level: 3}).waitFor();
  await page.locator('[data-planner-visit]', {hasText: 'Visita B'}).waitFor();
  assert.equal(await page.locator('[data-planner-visit]', {hasText: 'Visita fin de mes'}).count(), d.today === d.last ? 1 : 0);
  // Navegación con teclado: el día es un botón y Enter lo selecciona.
  await day(d.last).focus(); await page.keyboard.press('Enter');
  await page.locator('[data-planner-visit]', {hasText: 'Visita fin de mes'}).waitFor();
  assert.equal(await day(d.last).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('el calendario del Planner no desborda a 375 px y muestra un contador por día', async () => {
  const {context, page} = await newPage({hasTouch: true});
  const d = await calendarFixture(page);
  await page.setViewportSize({width: 375, height: 800});
  await page.evaluate(() => localStorage.setItem('solis.plannerView', 'calendar'));
  await page.reload({waitUntil: 'networkidle'});
  await page.click('[data-action=menu]');
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('.cal-grid').waitFor();
  const today = page.locator(`.cal-day[data-date="${d.today}"]`);
  assert.equal(await today.locator('.cal-chips').isVisible(), false);
  assert.match(await today.locator('.cal-count').textContent(), /^[23]$/);
  const box = await today.boundingBox();
  assert.ok(box.height >= 40 && box.width >= 40, 'el día es un objetivo táctil de al menos 40 px: ' + JSON.stringify(box));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[data-planner-visit]', {hasText: 'Visita A'}).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('el calendario avisa cuando los filtros no dejan visitas y abre el informe de una visita completada', async () => {
  const {context, page} = await newPage();
  const d = await calendarFixture(page);
  await page.evaluate(async () => {
    const db = await import('/js/store.js'), {newCatalog} = await import('/js/catalogs.js'), companyId = (await db.all('companies'))[0].id;
    await db.saveEntity('equipment', Object.assign(newCatalog('equipment', companyId), {name: 'Equipo Sin Visitas', tag: 'EQ-VACIO'}));
    const eq = (await db.all('equipment')).find(x => x.tag === 'EQ-CAL'), site = Object.assign(newCatalog('sites', companyId), {name: 'Planta Calendario', customerId: eq.customerId}); await db.saveEntity('sites', site); await db.saveEntity('equipment', {...eq, siteId: site.id});
    localStorage.setItem('solis.plannerView', 'calendar');
  });
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('.cal-grid').waitFor();
  await page.selectOption('[data-ops-filter="equipmentId"]', {label: 'EQ-VACIO · Equipo Sin Visitas'});
  await page.getByText('Ninguna visita coincide con los filtros.').waitFor();
  assert.equal(await page.locator('.cal-chip').count(), 0);
  await page.getByRole('button', {name: 'Quitar filtros'}).click();
  await page.locator('.cal-day', {hasText: 'Visita B'}).first().waitFor();
  assert.equal(await page.getByText('Ninguna visita coincide con los filtros.').count(), 0);
  // Visita completada con informe vivo: ofrece «Abrir informe» y no «Iniciar visita»; abrirlo no cambia la visita.
  await page.locator('[data-planner-visit]', {hasText: 'Visita B'}).getByRole('button', {name: 'Iniciar visita'}).click();
  await until(page, async () => (await (await import('/js/store.js')).all('workOrders')).some(r => r.planId && r.status === 'En curso' && r.reportId));
  const before = await page.evaluate(async () => { const db = await import('/js/store.js'), v = (await db.all('workOrders')).find(r => r.status === 'En curso'); await db.saveEntity('workOrders', {...v, status: 'Completada', notes: 'Realizada.'}); return v.id; });
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  const card = page.locator('[data-planner-visit]', {hasText: 'Visita B'});
  await card.waitFor();
  assert.equal(await card.getByRole('button', {name: 'Iniciar visita'}).count(), 0);
  await card.getByRole('button', {name: 'Abrir informe'}).click();
  await page.locator('#content [data-field]').first().waitFor();
  const after = await page.evaluate(async id => (await (await import('/js/store.js')).get('workOrders', id)).status, before);
  assert.equal(after, 'Completada');
  assert.deepEqual(page.errors, []);
  await context.close();
});

// Carga por técnico y reasignar. Fechas relativas a hoy (del navegador, que puede tener el reloj fijado).
async function loadFixture(page, {menu = false} = {}) {
  await page.goto(server.url, {waitUntil: 'networkidle'});
  if (menu) await page.click('[data-action=menu]');
  await createCompany(page);
  const info = await page.evaluate(async () => {
    const db = await import('/js/store.js'), {newCatalog} = await import('/js/catalogs.js'), {addDays} = await import('/js/planner.js'), {localDate} = await import('/js/domain.js');
    const companyId = (await db.all('companies'))[0].id, today = localDate();
    const customer = Object.assign(newCatalog('customers', companyId), {name: 'Cliente Carga'}); await db.saveEntity('customers', customer);
    const asset = Object.assign(newCatalog('equipment', companyId), {name: 'Equipo Carga', tag: 'EQ-CAR', customerId: customer.id}); await db.saveEntity('equipment', asset);
    await db.saveEntity('equipment', Object.assign(newCatalog('equipment', companyId), {name: 'Equipo Vacío', tag: 'EQ-VAC', customerId: customer.id}));
    const plan = Object.assign(newCatalog('workOrders', companyId), {name: 'Plan carga', type: 'Plan de mantenimiento', customerId: customer.id, equipmentId: asset.id, anchorDate: addDays(today, 400), dueDate: addDays(today, 400), intervalDays: '30', status: 'Planificada', planState: 'Activo', owner: 'Ana Pérez', ownerId: 'u-ana', scope: 'Revisar sellos', reportTemplate: 'general'});
    await db.saveEntity('workOrders', plan);
    const visit = (name, dueDate, extra = {}) => db.saveEntity('workOrders', Object.assign(newCatalog('workOrders', companyId), {name, type: 'Orden de trabajo', planId: plan.id, customerId: customer.id, equipmentId: asset.id, dueDate, status: 'Planificada', priority: 'Media'}, extra));
    const ana = {ownerId: 'u-ana', owner: 'Ana Pérez'}, beto = {owner: 'Beto Soto'};
    await visit('Visita A1', today, ana); await visit('Visita A2', addDays(today, 8), ana); await visit('Visita A3', addDays(today, -3), ana);
    await visit('Visita B1', addDays(today, 8), beto); await visit('Visita N1', today); await visit('Visita Hecha', today, {...ana, status: 'Completada'});
    await visit('Visita Lejana', addDays(today, 70), ana);
    // Columna de semana esperada (índice desde el lunes de esta semana) calculada con aritmética propia.
    const dn = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5, dow = (new Date(dn(today) * 864e5).getUTCDay() + 6) % 7;
    return {today, later: addDays(today, 8), laterCol: Math.floor((dow + 8) / 7)};
  });
  await page.reload({waitUntil: 'networkidle'});
  return info;
}
const openLoad = async page => {
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('[data-planner-visit]').first().waitFor();
  await page.getByRole('button', {name: 'Carga', exact: true}).click();
  await page.locator('.load-table').waitFor();
};
const loadRow = (page, name) => page.locator('.load-table tbody tr', {has: page.locator(`th:text-is("${name}")`)});
const cellAt = (page, name, col) => loadRow(page, name).locator('td').nth(col === 'overdue' ? 0 : col + 1).locator('button');
const asUser = (page, user) => page.evaluate(async u => { (await import('/js/sync.js')).syncState.user = u; }, user);
const people = [{id: 'u-ana', email: 'ana@e.test', role: 'technician'}, {id: 'u-sup', email: 'sup@e.test', role: 'supervisor'}];
const woRow = (page, name) => page.evaluate(async n => { const db = await import('/js/store.js'); return (await db.all('workOrders')).find(r => r.name === n); }, name);

test('la vista Carga cuenta las visitas abiertas por técnico y semana, y la celda elegida lista sus visitas', async () => {
  const {context, page} = await newPage();
  const d = await loadFixture(page);
  await openLoad(page);
  assert.equal(await page.getByRole('button', {name: 'Carga', exact: true}).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await page.locator('.load-table thead th').allTextContents().then(a => a.slice(0, 2)), ['Técnico', 'Vencidas']);
  assert.equal(await page.locator('.load-table thead th').count(), 8);
  assert.match(await page.locator('.load-table thead th').nth(2).textContent(), /^Sem\. \d{1,2} [a-z]{3}$/);
  assert.deepEqual(await page.locator('.load-table tbody th').allTextContents(), ['Ana Pérez', 'Beto Soto', 'Sin técnico']);
  assert.equal(await cellAt(page, 'Ana Pérez', 'overdue').textContent(), '1');
  assert.equal(await cellAt(page, 'Ana Pérez', 0).textContent(), '1', 'la completada y la lejana no cuentan');
  assert.equal(await cellAt(page, 'Ana Pérez', d.laterCol).textContent(), '1');
  assert.equal(await cellAt(page, 'Beto Soto', d.laterCol).textContent(), '1');
  assert.equal(await cellAt(page, 'Sin técnico', 0).textContent(), '1');
  assert.match(await cellAt(page, 'Ana Pérez', 0).getAttribute('aria-label'), /^Ana Pérez, semana del \d{1,2} de [a-zé]+: 1 visita$/);
  assert.equal(await cellAt(page, 'Ana Pérez', 'overdue').getAttribute('aria-label'), 'Ana Pérez, vencidas: 1 visita');
  assert.match(await cellAt(page, 'Ana Pérez', 0).getAttribute('class'), /load-3/);
  assert.match(await cellAt(page, 'Beto Soto', d.laterCol).getAttribute('class'), /load-\d/);
  assert.match(await cellAt(page, 'Sin técnico', 3).getAttribute('class'), /load-0/);
  await page.getByText('Elige una celda para ver sus visitas.').waitFor();
  assert.equal(await page.locator('[data-planner-visit]').count(), 0);
  await cellAt(page, 'Ana Pérez', 0).click();
  assert.equal(await cellAt(page, 'Ana Pérez', 0).getAttribute('aria-pressed'), 'true');
  assert.equal(await cellAt(page, 'Ana Pérez', 0).evaluate(el => document.activeElement === el), true);
  assert.equal(await page.locator('[data-planner-visit]').count(), 1);
  await page.locator('[data-planner-visit]', {hasText: 'Visita A1'}).waitFor();
  await page.locator('[data-planner-visit]', {hasText: 'Visita A1'}).getByRole('button', {name: 'Reasignar'}).waitFor();
  await cellAt(page, 'Ana Pérez', 'overdue').click();
  await page.locator('[data-planner-visit]', {hasText: 'Visita A3'}).waitFor();
  assert.equal(await page.locator('[data-planner-visit]').count(), 1);
  assert.equal(await cellAt(page, 'Ana Pérez', 0).getAttribute('aria-pressed'), 'false');
  await cellAt(page, 'Ana Pérez', 'overdue').click();
  await page.getByText('Elige una celda para ver sus visitas.').waitFor();
  // un filtro que no coincide con ninguna visita deja la tabla vacía con aviso; quitarlo la restaura
  await page.selectOption('[data-ops-filter=equipmentId]', {label: 'EQ-VAC · Equipo Vacío'});
  await page.getByText('Ninguna visita coincide con los filtros.').waitFor();
  assert.equal(await page.locator('.load-table').count(), 0);
  await page.getByRole('button', {name: 'Quitar filtros'}).click();
  await page.locator('.load-table').waitFor();
  await page.selectOption('[data-ops-filter=ownerId]', {value: 'u-ana'});
  assert.deepEqual(await page.locator('.load-table tbody th').allTextContents(), ['Ana Pérez']);
  await page.getByRole('button', {name: 'Carga', exact: true}).click();
  await page.selectOption('[data-ops-filter=ownerId]', {value: ''});
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('.load-table').waitFor();
  assert.equal(await page.getByRole('button', {name: 'Carga', exact: true}).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', {name: 'Lista', exact: true}).click();
  await page.locator('.planner-section h2:text-is("Hoy")').waitFor();
  assert.equal(await page.locator('.load-table').count(), 0);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('reasignar una visita en modo local cambia de fila, marca la edición manual y se puede cancelar con Escape', async () => {
  const {context, page} = await newPage();
  await loadFixture(page);
  await openLoad(page);
  await cellAt(page, 'Ana Pérez', 0).click();
  const card = page.locator('[data-planner-visit]', {hasText: 'Visita A1'});
  await card.getByRole('button', {name: 'Reasignar'}).click();
  await page.getByRole('dialog', {name: 'Reasignar visita'}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.modal').count(), 0);
  assert.equal((await woRow(page, 'Visita A1')).manualEdit || '', '');
  await card.getByRole('button', {name: 'Reasignar'}).click();
  await page.fill('input[name=owner]', 'Beto Soto');
  await page.getByRole('button', {name: 'Reasignar', exact: true}).last().dblclick();
  await page.locator('.modal').waitFor({state: 'detached'});
  const row = await woRow(page, 'Visita A1');
  assert.equal(row.owner, 'Beto Soto'); assert.equal(row.ownerId || '', ''); assert.equal(row.manualEdit, '1');
  assert.equal(await cellAt(page, 'Ana Pérez', 0).textContent(), '0');
  assert.equal(await cellAt(page, 'Beto Soto', 0).textContent(), '1');
  assert.deepEqual(await page.locator('.load-table tbody th').allTextContents(), ['Ana Pérez', 'Beto Soto', 'Sin técnico']);
  assert.equal(await page.locator('[data-planner-visit]').count(), 0, 'la celda elegida quedó sin esa visita y se ve la guía o la lista vacía');
  // Enter en el campo de texto guarda sin recargar la página
  const url = page.url();
  await cellAt(page, 'Sin técnico', 0).click();
  await page.locator('[data-planner-visit]', {hasText: 'Visita N1'}).getByRole('button', {name: 'Reasignar'}).click();
  await page.fill('input[name=owner]', 'Carla Díaz');
  await page.press('input[name=owner]', 'Enter');
  await page.locator('.modal').waitFor({state: 'detached'});
  assert.equal(page.url(), url);
  const carla = await woRow(page, 'Visita N1');
  assert.equal(carla.owner, 'Carla Díaz'); assert.equal(carla.manualEdit, '1');
  // el campo admite como máximo 200 caracteres
  await cellAt(page, 'Carla Díaz', 0).click();
  await page.locator('[data-planner-visit]', {hasText: 'Visita N1'}).getByRole('button', {name: 'Reasignar'}).click();
  assert.equal(await page.locator('input[name=owner]').getAttribute('maxlength'), '200');
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('sin sesión y con el rol de supervisor guardado, Reasignar pide conectarse y no cambia la visita', async () => {
  const {context, page} = await newPage();
  await loadFixture(page);
  await page.evaluate(async () => { await (await import('/js/store.js')).setMeta('lastRole', 'supervisor'); });
  await page.reload({waitUntil: 'networkidle'});
  await openLoad(page);
  await cellAt(page, 'Ana Pérez', 0).click();
  const before = await woRow(page, 'Visita A1');
  await page.locator('[data-planner-visit]', {hasText: 'Visita A1'}).getByRole('button', {name: 'Reasignar'}).click();
  await page.getByText('Conéctate para elegir a la persona de la empresa.').waitFor();
  assert.equal(await page.locator('.modal').count(), 0);
  const after = await woRow(page, 'Visita A1');
  assert.equal(after.ownerId, 'u-ana'); assert.equal(after.updatedAt, before.updatedAt); assert.equal(after.manualEdit || '', '');
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('un supervisor con sesión elige a la persona de una lista; sin cambios y cambios concurrentes se avisan sin escribir', async () => {
  const {context, page} = await newPage();
  await page.route('**/api/people*', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({users: people})}));
  await loadFixture(page);
  await openLoad(page);
  await asUser(page, {id: 'u-sup', role: 'supervisor', email: 'sup@e.test', companyIds: ['*']});
  await cellAt(page, 'Sin técnico', 0).click();
  const card = page.locator('[data-planner-visit]', {hasText: 'Visita N1'});
  await card.getByRole('button', {name: 'Reasignar'}).click();
  const dlg = page.getByRole('dialog', {name: 'Reasignar visita'});
  await dlg.getByText('Sin técnico', {exact: true}).waitFor();
  assert.equal(await dlg.getByRole('radio', {name: 'Sin técnico'}).isChecked(), true);
  assert.deepEqual(await dlg.locator('label span').allTextContents(), ['Sin técnico', 'ana@e.test · Técnico', 'sup@e.test · Supervisor']);
  await dlg.getByRole('radio', {name: /sup@e\.test/}).check();
  await dlg.getByRole('button', {name: 'Reasignar', exact: true}).click();
  await page.locator('.modal').waitFor({state: 'detached'});
  const row = await woRow(page, 'Visita N1');
  assert.equal(row.ownerId, 'u-sup'); assert.equal(row.owner, 'sup@e.test'); assert.equal(row.manualEdit, '1');
  assert.deepEqual(await page.locator('.load-table tbody th').allTextContents(), ['ana@e.test', 'Beto Soto', 'sup@e.test'], 'con la lista de personas, la cuenta se muestra por su correo');
  // mismo responsable: sin cambios
  await asUser(page, {id: 'u-sup', role: 'supervisor', email: 'sup@e.test', companyIds: ['*']}); // la sincronización sin servidor quita la sesión simulada
  await cellAt(page, 'sup@e.test', 0).click();
  await page.locator('[data-planner-visit]', {hasText: 'Visita N1'}).getByRole('button', {name: 'Reasignar'}).click();
  assert.equal(await dlg.getByRole('radio', {name: /sup@e\.test/}).isChecked(), true);
  const before = (await woRow(page, 'Visita N1')).updatedAt;
  await dlg.getByRole('button', {name: 'Reasignar', exact: true}).click();
  await page.getByText('Sin cambios').waitFor();
  assert.equal((await woRow(page, 'Visita N1')).updatedAt, before);
  // cambio concurrente en otro dispositivo (el almacén cambia detrás de la pantalla)
  await asUser(page, {id: 'u-sup', role: 'supervisor', email: 'sup@e.test', companyIds: ['*']});
  await page.locator('[data-planner-visit]', {hasText: 'Visita N1'}).getByRole('button', {name: 'Reasignar'}).click();
  await dlg.getByRole('radio', {name: /ana@e\.test/}).check();
  await page.evaluate(async () => { const db = await import('/js/store.js'), r = (await db.all('workOrders')).find(x => x.name === 'Visita N1'); await db.saveEntity('workOrders', {...r, priority: 'Alta'}); });
  await dlg.getByRole('button', {name: 'Reasignar', exact: true}).click();
  await page.getByText('Esta visita cambió en otro dispositivo. Actualiza la pantalla e inténtalo de nuevo.').waitFor();
  const after = await woRow(page, 'Visita N1');
  assert.equal(after.ownerId, 'u-sup'); assert.equal(after.priority, 'Alta');
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('un técnico no ve Reasignar y abre los planes en solo lectura', async () => {
  const {context, page} = await newPage();
  await page.route('**/api/people*', route => route.fulfill({status: 403, contentType: 'application/json', body: '{"error":"no"}'}));
  await loadFixture(page);
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('[data-planner-visit]').first().waitFor();
  await asUser(page, {id: 'u-ana', role: 'technician', email: 'ana@e.test', companyIds: ['*']});
  await page.getByRole('button', {name: 'Carga', exact: true}).click();
  await cellAt(page, 'Ana Pérez', 0).click();
  await page.locator('[data-planner-visit]', {hasText: 'Visita A1'}).waitFor();
  assert.equal(await page.getByRole('button', {name: 'Reasignar'}).count(), 0);
  await page.getByRole('button', {name: 'Lista', exact: true}).click();
  await page.locator('[data-planner-visit]').first().waitFor();
  assert.equal(await page.getByRole('button', {name: 'Reasignar'}).count(), 0);
  assert.equal(await page.getByRole('button', {name: 'Pausar plan'}).count(), 0);
  assert.equal(await page.getByRole('button', {name: 'Editar plan'}).count(), 0);
  await page.getByRole('button', {name: 'Ver plan'}).click();
  const dlg = page.getByRole('dialog', {name: 'Plan de mantenimiento'});
  await dlg.getByText('Solo un administrador o supervisor puede editar este plan.').waitFor();
  assert.equal(await dlg.locator('input').count() >= 6, true);
  assert.equal(await dlg.locator('input:not([disabled]),textarea:not([disabled]),select:not([disabled])').count(), 0);
  assert.equal(await dlg.locator('input').first().inputValue(), 'Plan carga');
  assert.equal(await dlg.locator('textarea').inputValue(), 'Revisar sellos');
  assert.equal(await dlg.getByLabel('Estado del plan').inputValue(), 'Activo');
  assert.equal(await dlg.getByLabel('Periodicidad (días)').inputValue(), '30');
  assert.equal(await page.locator('[data-action=planner-plan-save]').count(), 0);
  await dlg.getByRole('button', {name: 'Cerrar', exact: true}).last().click();
  assert.equal(await page.locator('.modal').count(), 0);
  // el supervisor sí edita
  await asUser(page, {id: 'u-sup', role: 'supervisor', email: 'sup@e.test', companyIds: ['*']});
  await page.getByRole('button', {name: 'Lista', exact: true}).click();
  await page.getByRole('button', {name: 'Editar plan'}).click();
  await page.getByRole('dialog', {name: 'Editar plan'}).waitFor();
  assert.equal(await page.locator('[data-action=planner-plan-save]').count(), 1);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('la vista Carga no desborda la página a 375 px y la tabla se desplaza dentro de su contenedor', async () => {
  const {context, page} = await newPage({hasTouch: true});
  await page.setViewportSize({width: 375, height: 800});
  await loadFixture(page, {menu: true});
  await page.click('[data-action=menu]');
  await openLoad(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const wrap = await page.locator('.load-wrap').evaluate(el => ({scroll: el.scrollWidth, client: el.clientWidth, over: getComputedStyle(el).overflowX}));
  assert.equal(wrap.over, 'auto'); assert.ok(wrap.scroll > wrap.client, JSON.stringify(wrap));
  const box = await cellAt(page, 'Ana Pérez', 0).boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, JSON.stringify(box));
  await cellAt(page, 'Ana Pérez', 0).click();
  await page.locator('[data-planner-visit]', {hasText: 'Visita A1'}).getByRole('button', {name: 'Reasignar'}).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(page.errors, []);
  await context.close();
});

// Indicadores de cumplimiento. Fechas relativas a hoy (del navegador, que puede tener el reloj fijado).
async function kpiFixture(page, {menu = false, visits = true} = {}) {
  await page.goto(server.url, {waitUntil: 'networkidle'});
  if (menu) await page.click('[data-action=menu]');
  await createCompany(page);
  const today = await page.evaluate(async seed => {
    const db = await import('/js/store.js'), {newCatalog} = await import('/js/catalogs.js'), {addDays} = await import('/js/planner.js'), {localDate, newReport} = await import('/js/domain.js');
    const company = (await db.all('companies'))[0], companyId = company.id, today = localDate(), ago = n => addDays(today, -n);
    const customer = Object.assign(newCatalog('customers', companyId), {name: 'Cliente KPI'}); await db.saveEntity('customers', customer);
    const asset = Object.assign(newCatalog('equipment', companyId), {name: 'Equipo KPI', tag: 'EQ-KPI', customerId: customer.id}); await db.saveEntity('equipment', asset);
    const plan = Object.assign(newCatalog('workOrders', companyId), {name: 'Plan KPI', type: 'Plan de mantenimiento', customerId: customer.id, equipmentId: asset.id, anchorDate: addDays(today, 400), dueDate: addDays(today, 400), intervalDays: '30', status: 'Planificada', planState: 'Activo'});
    await db.saveEntity('workOrders', plan);
    if (!seed) return today;
    const visit = async (name, due, extra = {}, doneOn) => {
      const rep = doneOn ? Object.assign(newReport('general', company, 'KPI-' + name), {serviceDate: doneOn, status: 'Emitido'}) : null;
      if (rep) await db.saveEntity('reports', rep);
      await db.saveEntity('workOrders', Object.assign(newCatalog('workOrders', companyId), {name, type: 'Orden de trabajo', planId: plan.id, customerId: customer.id, equipmentId: asset.id, dueDate: due, status: 'Planificada', priority: 'Media', reportId: rep?.id || ''}, extra));
    };
    const ana = {ownerId: 'u-ana', owner: 'Ana Pérez'}, beto = {owner: 'Beto Soto'}, c = {status: 'Completada'};
    await visit('Visita K1', ago(20), {...ana, ...c}, ago(20)); await visit('Visita K2', ago(15), {...ana, ...c}, ago(12)); await visit('Visita K3', ago(10), ana);
    await visit('Visita K4', ago(8), {...beto, ...c}, ago(9)); await visit('=Revisar K5', ago(6), {...beto, ...c}, ago(2)); await visit('Visita K6', ago(4), {...beto, ...c});
    await visit('Visita K7', ago(40), c, ago(40)); await visit('Visita K8', ago(35), {status: 'En curso'});
    await visit('Visita cancelada', ago(5), {...ana, status: 'Cancelada'}); await visit('Visita futura', addDays(today, 5), ana); await visit('Visita de hoy', today, ana);
    return today;
  }, visits);
  await page.reload({waitUntil: 'networkidle'});
  return today;
}
const openKpi = async page => {
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.getByRole('button', {name: 'Indicadores', exact: true}).click();
};
const kpiValue = (page, label) => page.locator('.kpi-card', {has: page.locator(`.kpi-label:text-is("${label}")`)}).locator('.kpi-value');
const norm = s => s.replace(/\s/g, ' ');
const kpiRows = page => page.locator('.kpi-table tbody tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(c => c.textContent.replace(/\s/g, ' '))));

test('Indicadores muestra tarjetas, tabla por técnico y meses con valores exactos y cambia con el período', async () => {
  const {context, page} = await newPage();
  await kpiFixture(page);
  await openKpi(page);
  await page.locator('.kpi-cards').waitFor();
  assert.equal(await page.locator('[data-action="planner-view"][aria-pressed=true]').textContent(), 'Indicadores');
  assert.equal(await page.locator('[data-action="planner-kpi-days"][aria-pressed=true]').getAttribute('data-days'), '90');
  // 90 días: 8 medibles (K1-K8), 6 completadas, 3 a tiempo, 2 tardías (3 y 4 días), 1 sin fecha, 2 vencidas abiertas (la más antigua 35 días).
  assert.equal(norm(await kpiValue(page, 'Cumplimiento').textContent()), '75 %');
  assert.equal(norm(await kpiValue(page, 'Puntualidad').textContent()), '60 %');
  assert.equal(await kpiValue(page, 'Atraso promedio').textContent(), '3,5 días');
  assert.equal(await kpiValue(page, 'Vencidas abiertas').textContent(), '2');
  assert.match(await page.locator('.kpi-card', {hasText: 'Vencidas abiertas'}).locator('.kpi-note').textContent(), /35 días de atraso/);
  assert.match(await page.locator('.kpi-measured').textContent(), /Visitas medidas: 8/);
  assert.match(await page.locator('.kpi-card', {hasText: 'Puntualidad'}).locator('.kpi-note').textContent(), /3 de 5 visitas realizadas a tiempo \(1 sin fecha de realización\)/);
  assert.deepEqual(await page.locator('.kpi-table thead th').allTextContents(), ['Técnico', 'Medibles', 'Completadas', 'A tiempo', 'Tardías', 'Abiertas vencidas', 'Cumplimiento']);
  assert.deepEqual(await kpiRows(page), [['Sin técnico', '2', '1', '1', '0', '1', '50 %'], ['Ana Pérez', '3', '2', '1', '1', '1', '67 %'], ['Beto Soto', '3', '3', '1', '1', '0', '100 %']]);
  const monthSum = async () => (await page.locator('.kpi-month-text').allTextContents()).reduce(([c, m], t) => { const x = t.match(/(\d+) de (\d+)/); return x ? [c + +x[1], m + +x[2]] : [c, m]; }, [0, 0]);
  assert.deepEqual(await monthSum(), [6, 8]);
  assert.ok(await page.locator('.kpi-month').count() <= 7);
  assert.ok(await page.locator('.kpi-bar[role=img]').first().getAttribute('aria-label'));
  // 30 días: K7 y K8 salen de la ventana.
  await page.getByRole('button', {name: 'Últimos 30 días'}).click();
  assert.equal(await page.locator('[data-action="planner-kpi-days"][aria-pressed=true]').getAttribute('data-days'), '30');
  assert.equal(norm(await kpiValue(page, 'Cumplimiento').textContent()), '83 %');
  assert.equal(norm(await kpiValue(page, 'Puntualidad').textContent()), '50 %');
  assert.equal(await kpiValue(page, 'Atraso promedio').textContent(), '3,5 días');
  assert.equal(await kpiValue(page, 'Vencidas abiertas').textContent(), '1');
  assert.match(await page.locator('.kpi-card', {hasText: 'Vencidas abiertas'}).locator('.kpi-note').textContent(), /10 días de atraso/);
  assert.match(await page.locator('.kpi-card', {hasText: 'Vencidas abiertas'}).locator('.kpi-note').textContent(), /en el período/);
  assert.deepEqual(await kpiRows(page), [['Ana Pérez', '3', '2', '1', '1', '1', '67 %'], ['Beto Soto', '3', '3', '1', '1', '0', '100 %']]);
  assert.deepEqual(await monthSum(), [5, 6]);
  await page.getByRole('button', {name: '180 días'}).click();
  assert.equal(norm(await kpiValue(page, 'Cumplimiento').textContent()), '75 %');
  // Un filtro de técnico (con cuenta) se aplica a todo; la vista se recuerda al recargar, el período no.
  await page.selectOption('[data-ops-filter="ownerId"]', {label: 'Ana Pérez'});
  assert.equal(norm(await kpiValue(page, 'Cumplimiento').textContent()), '67 %');
  assert.equal(await kpiValue(page, 'Vencidas abiertas').textContent(), '1');
  await page.reload({waitUntil: 'networkidle'});
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('.kpi-cards').waitFor();
  assert.equal(await page.locator('[data-action="planner-kpi-days"][aria-pressed=true]').getAttribute('data-days'), '90');
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('Indicadores exporta el detalle de las visitas medidas como CSV', async () => {
  const {context, page} = await newPage();
  const today = await kpiFixture(page);
  await openKpi(page);
  await page.locator('.kpi-cards').waitFor();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Exportar CSV'}).click()]);
  assert.equal(download.suggestedFilename(), `planner-indicadores-${today}.csv`);
  const chunks = []; for await (const c of await download.createReadStream()) chunks.push(c);
  const buf = Buffer.concat(chunks), text = buf.toString('utf8'), lines = text.split('\r\n');
  assert.deepEqual([...buf.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
  assert.equal(lines[0], '﻿Fecha programada;Fecha realizada;Estado;Días de atraso;Plan;Equipo;Técnico');
  assert.equal(lines.length, 10, 'encabezado + 8 visitas + línea final vacía');
  const rel = n => page.evaluate(async n => (await import('/js/planner.js')).addDays((await import('/js/domain.js')).localDate(), -n), n);
  assert.equal(lines[1], `${await rel(40)};${await rel(40)};Completada;0;Visita K7;EQ-KPI · Equipo KPI;Sin técnico`);
  assert.equal(lines[5], `${await rel(10)};;Vencida;10;Visita K3;EQ-KPI · Equipo KPI;Ana Pérez`);
  assert.ok(lines.some(l => l.includes(";'=Revisar K5;")), 'el nombre que empieza por = se prefija con apóstrofo');
  const d2 = await rel(2);
  assert.ok(lines.some(l => l.includes(`;${d2};Completada;4;`)));
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('Indicadores sin visitas medibles muestra el estado vacío y no ofrece exportar', async () => {
  const {context, page} = await newPage();
  await kpiFixture(page, {visits: false});
  await openKpi(page);
  await page.getByText('Aún no hay visitas vencidas o completadas en este período.').waitFor();
  assert.equal(await page.locator('.kpi-cards, .kpi-table').count(), 0);
  assert.equal(await page.getByRole('button', {name: 'Exportar CSV'}).count(), 0);
  assert.equal(await page.locator('[data-action="planner-kpi-days"]').count(), 3);
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('Indicadores no desborda a 375 px y la tabla se desplaza dentro de su contenedor', async () => {
  const {context, page} = await newPage({hasTouch: true});
  await page.setViewportSize({width: 375, height: 800});
  await kpiFixture(page, {menu: true});
  await page.evaluate(() => localStorage.setItem('solis.plannerView', 'kpi'));
  await page.reload({waitUntil: 'networkidle'});
  await page.click('[data-action=menu]');
  await page.locator('nav').getByText('Planner', {exact: true}).click();
  await page.locator('.kpi-cards').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const wrap = await page.locator('.kpi-wrap').evaluate(el => ({scroll: el.scrollWidth, client: el.clientWidth, over: getComputedStyle(el).overflowX}));
  assert.equal(wrap.over, 'auto'); assert.ok(wrap.scroll > wrap.client, JSON.stringify(wrap));
  const box = await page.locator('[data-action="planner-kpi-days"]').first().boundingBox();
  assert.ok(box.height >= 40, JSON.stringify(box));
  assert.deepEqual(page.errors, []);
  await context.close();
});

test('Indicadores concuerda el singular en la nota de cumplimiento', async () => {
  const {context, page} = await newPage();
  await kpiFixture(page, {visits: false});
  await page.evaluate(async () => {
    const db = await import('/js/store.js'), {newCatalog} = await import('/js/catalogs.js'), {addDays} = await import('/js/planner.js'), {localDate} = await import('/js/domain.js');
    const companyId = (await db.all('companies'))[0].id, plan = (await db.all('workOrders')).find(r => r.type === 'Plan de mantenimiento');
    await db.saveEntity('workOrders', Object.assign(newCatalog('workOrders', companyId), {name: 'Visita única', type: 'Orden de trabajo', planId: plan.id, equipmentId: plan.equipmentId, dueDate: addDays(localDate(), -3), status: 'Completada'}));
  });
  await page.reload({waitUntil: 'networkidle'});
  await openKpi(page);
  await page.locator('.kpi-cards').waitFor();
  assert.equal(norm(await kpiValue(page, 'Cumplimiento').textContent()), '100 %');
  assert.equal(norm(await page.locator('.kpi-card', {hasText: 'Cumplimiento'}).locator('.kpi-note').textContent()), '1 de 1 visita medida realizada');
  assert.match(await page.locator('.kpi-card', {hasText: 'Vencidas abiertas'}).locator('.kpi-note').textContent(), /Ninguna vencida programada en el período/);
  assert.deepEqual(page.errors, []);
  await context.close();
});
