import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnvironment, memoryBucket} from '../scripts/local-bindings.mjs';
import worker from '../worker/index.js';
import {newCompany, uid} from '../public/js/domain.js';
import {newOperation} from '../public/js/operations.js';
import {plansFromForm} from '../public/js/planner.js';
import {cleanupShares, backupWorkspaces, sendDigests, buildDigest, runScheduled} from '../worker/scheduled.js';

async function call(env, path, body, cookie = '') {
  const response = await worker.fetch(new Request('https://solis.test' + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', 'X-Solis-Client': '6', ...(cookie ? {Cookie: cookie} : {})}, body: body === undefined ? undefined : JSON.stringify(body)}), env, {waitUntil() {}});
  return {status: response.status, response, value: response.headers.get('Content-Type')?.includes('json') ? await response.json() : await response.text()};
}
const push = (env, cookie, kind, data) => call(env, '/api/sync/push', {kind, id: data.id, data, baseVersion: 0, mutationId: uid(), deleted: false}, cookie);
async function setup() {
  const env = makeEnvironment(), first = await call(env, '/api/setup', {email: 'admin@scheduled.test', password: 'scheduled-password-1', setupToken: env.SETUP_TOKEN});
  assert.equal(first.status, 201);
  const cookie = first.response.headers.get('Set-Cookie').split(';')[0], company = {...newCompany(), name: 'Empresa Programada'};
  assert.equal((await push(env, cookie, 'companies', company)).status, 200);
  return {env, cookie, company};
}
const DAY = 86400000;

test('limpieza: borra copias de enlaces caducados hace más de 30 días y conserva el resto', async () => {
  const {env} = await setup(), now = Date.now();
  for (const [hash, expires, revoked] of [['old', now - 40 * DAY, 0], ['recent', now - 5 * DAY, 0], ['active', now + 3 * DAY, 0], ['oldrevoked', now - 35 * DAY, 1]]) {
    await env.BUCKET.put(`ws/shares/${hash}.json`, '{}');
    await env.DB.prepare('INSERT INTO shares(token_hash,workspace_id,report_id,object_key,created_by,expires_at,revoked) VALUES(?,?,?,?,?,?,?)').bind(hash, 'ws', 'r', `ws/shares/${hash}.json`, 'u', expires, revoked).run();
  }
  assert.equal(await cleanupShares(env, now), 2);
  assert.equal(await env.BUCKET.head('ws/shares/old.json'), null);
  assert.equal(await env.BUCKET.head('ws/shares/oldrevoked.json'), null);
  assert.ok(await env.BUCKET.head('ws/shares/recent.json') && await env.BUCKET.head('ws/shares/active.json'));
  assert.deepEqual((await env.DB.prepare('SELECT token_hash FROM shares ORDER BY token_hash').all()).results.map(r => r.token_hash), ['active', 'recent']);
  env.DB.close();
});

test('respaldo: exporta cada espacio, no repite el mismo día, usa un destino aparte y conserva N días', async () => {
  const {env, company} = await setup();
  env.BACKUP_BUCKET = memoryBucket();
  env.BACKUP_KEEP_DAYS = '2';
  const first = await backupWorkspaces(env, new Date('2026-11-01T11:00:00Z'));
  assert.equal(first.workspaces, 1);
  assert.ok(first.items >= 1);
  const workspace = (await env.DB.prepare('SELECT id FROM workspaces').first()).id;
  const manifest = await (await env.BACKUP_BUCKET.get(`backups/2026-11-01/${workspace}/manifest.json`)).json();
  assert.equal(manifest.counts.companies, 1);
  const exported = await (await env.BACKUP_BUCKET.get(`backups/2026-11-01/${workspace}/companies-0000.json`)).json();
  assert.equal(exported.items[0].data.id, company.id, 'se puede reconstruir el registro');
  assert.equal(exported.items[0].data.name, 'Empresa Programada');
  const users = await (await env.BACKUP_BUCKET.get(`backups/2026-11-01/${workspace}/users.json`)).json();
  assert.ok(!JSON.stringify(users).includes('password') && !JSON.stringify(users).includes('salt'), 'no exporta credenciales');
  assert.equal((await backupWorkspaces(env, new Date('2026-11-01T18:00:00Z'))).workspaces, 0, 'idempotente en el mismo día');
  await backupWorkspaces(env, new Date('2026-11-02T11:00:00Z'));
  const third = await backupWorkspaces(env, new Date('2026-11-03T11:00:00Z'));
  assert.ok(third.deleted > 0);
  assert.equal(await env.BACKUP_BUCKET.head(`backups/2026-11-01/${workspace}/manifest.json`), null);
  assert.ok(await env.BACKUP_BUCKET.head(`backups/2026-11-02/${workspace}/manifest.json`));
  assert.ok(await env.BACKUP_BUCKET.head(`backups/2026-11-03/${workspace}/manifest.json`));
  assert.equal((await env.BUCKET.list({prefix: 'backups/'})).objects.length, 0, 'el bucket principal queda intacto');
  env.DB.close();
});

function emailStub(status = 200) {
  const sent = [], original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({url, headers: init.headers, body: JSON.parse(init.body)}); return new Response(JSON.stringify({id: 'msg_' + sent.length}), {status}); };
  return {sent, restore: () => { globalThis.fetch = original; }};
}
async function overdueTask(env, cookie, company, name = 'Cambiar medio filtrante') {
  const task = Object.assign(newOperation('tasks', company.id), {name, dueDate: '2026-10-01', priority: 'Alta', status: 'Pendiente', owner: 'Técnico'});
  assert.equal((await push(env, cookie, 'tasks', task)).status, 200);
}

test('resumen diario: envía una vez por día, solo a quien corresponde, y reintenta si falla el proveedor', async () => {
  const {env, cookie, company} = await setup();
  const now = new Date('2026-11-02T11:00:00Z');
  await overdueTask(env, cookie, company);
  env.RESEND_API_KEY = 'test-key'; env.EMAIL_FROM = 'avisos@example.test'; env.APP_URL = 'https://solis.test';
  const failing = emailStub(500);
  assert.equal((await sendDigests(env, now)).sent, 0);
  failing.restore();
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM notification_log').first()).n, 0, 'un fallo no consume el aviso del día');
  const ok = emailStub();
  assert.equal((await sendDigests(env, now)).sent, 1);
  assert.equal(ok.sent.length, 1);
  assert.deepEqual(ok.sent[0].body.to, ['admin@scheduled.test']);
  assert.match(ok.sent[0].body.subject, /Resumen diario · 1 punto pendiente/);
  assert.ok(ok.sent[0].body.text.includes('Cambiar medio filtrante') && ok.sent[0].body.text.includes('https://solis.test'));
  assert.equal(ok.sent[0].headers['Idempotency-Key'].startsWith('digest:'), true);
  assert.equal((await sendDigests(env, now)).sent, 0, 'no se repite el mismo día');
  assert.equal((await sendDigests(env, new Date('2026-11-03T11:00:00Z'))).sent, 1, 'al día siguiente vuelve a avisar');
  ok.restore();
  env.DB.close();
});

test('el resumen respeta empresas asignadas, ignora clientes y se puede desactivar', async () => {
  const {env, cookie, company} = await setup();
  await overdueTask(env, cookie, company);
  const task = {companyId: company.id, status: 'Pendiente', dueDate: '2026-10-01', name: 'Tarea', priority: 'Alta', owner: ''};
  const data = {reports: [], tasks: [{...task, id: 't1'}], orders: [], rules: [], shares: [], timeZone: 'America/Santiago', appUrl: '', appName: 'SOLIS Field'};
  assert.equal(buildDigest({id: 'u', email: 'x@y.z', role: 'technician', companyIds: ['otra-empresa']}, data, '2026-11-02', Date.now()), null);
  assert.ok(buildDigest({id: 'u', email: 'x@y.z', role: 'technician', companyIds: [company.id]}, data, '2026-11-02', Date.now()));
  const vencida = buildDigest({id: 'u', email: 'x@y.z', role: 'admin', companyIds: ['*']}, {...data, orders: [{companyId: company.id, status: 'Planificada', dueDate: '2026-10-30', name: 'Mantención de bombas', owner: ''}]}, '2026-11-02', Date.UTC(2026, 10, 2));
  assert.match(vencida.text, /VENCIDA 2026-10-30 · Mantención de bombas/);
  env.RESEND_API_KEY = 'k'; env.EMAIL_FROM = 'a@b.c'; env.DIGEST_ENABLED = 'false';
  const stub = emailStub();
  assert.equal((await sendDigests(env, new Date('2026-11-02T11:00:00Z'))).sent, 0);
  assert.equal(stub.sent.length, 0);
  stub.restore();
  env.DB.close();
});

test('el resumen marca visitas vencidas y omite los planes nuevos sin fecha programada', async () => {
  const {env, company} = await setup();
  const base = {companyId: company.id, status: 'Planificada', owner: ''};
  const data = {reports: [], tasks: [], rules: [], shares: [], timeZone: 'America/Santiago', appUrl: '', appName: 'SOLIS Field', orders: [
    {...base, id: 'v1', type: 'Orden de trabajo', name: 'Visita atrasada', dueDate: '2026-11-01'},
    {...base, id: 'v2', type: 'Orden de trabajo', name: 'Visita de la semana', dueDate: '2026-11-05'},
    {...base, id: 'p1', type: 'Plan de mantenimiento', name: 'Plan nuevo', dueDate: '', anchorDate: '2026-11-01', planState: 'Activo', intervalDays: '30'}]};
  const digest = buildDigest({id: 'u', email: 'x@y.z', role: 'admin', companyIds: ['*']}, data, '2026-11-02', Date.UTC(2026, 10, 2));
  assert.match(digest.text, /VENCIDA 2026-11-01 · Visita atrasada/);
  assert.match(digest.text, /\n\s+• 2026-11-05 · Visita de la semana/);
  assert.ok(!digest.text.includes('VENCIDA 2026-11-05'));
  assert.ok(!digest.text.includes('Plan nuevo'));
  assert.match(digest.text, /Órdenes y mantenimientos \(2\)/);
  env.DB.close();
});

test('el resumen omite planes del planner con ancla pasada y conserva los heredados', async () => {
  const {env, company} = await setup();
  const [plan] = plansFromForm({name: 'Plan real', equipmentIds: ['eq1'], anchorDate: '2026-11-01', intervalDays: '30'}, [{id: 'eq1', companyId: company.id, tag: 'B-1', name: 'Bomba'}], company.id);
  assert.equal(plan.dueDate, '2026-11-01');
  assert.equal(plan.status, 'Planificada');
  const legacy = {companyId: company.id, id: 'l1', type: 'Plan de mantenimiento', status: 'Planificada', name: 'Plan heredado', dueDate: '2026-11-01', anchorDate: '', planState: '', owner: ''};
  const data = {reports: [], tasks: [], rules: [], shares: [], timeZone: 'America/Santiago', appUrl: '', appName: 'SOLIS Field', orders: [plan, legacy, {companyId: company.id, id: 'v1', type: 'Orden de trabajo', status: 'Planificada', name: 'Visita atrasada', dueDate: '2026-11-01', owner: ''}]};
  const digest = buildDigest({id: 'u', email: 'x@y.z', role: 'admin', companyIds: ['*']}, data, '2026-11-02', Date.UTC(2026, 10, 2));
  assert.ok(!digest.text.includes('Plan real'));
  assert.match(digest.text, /VENCIDA 2026-11-01 · Plan heredado/);
  assert.match(digest.text, /VENCIDA 2026-11-01 · Visita atrasada/);
  assert.match(digest.text, /Órdenes y mantenimientos \(2\)/);
  env.DB.close();
});

test('la tarea programada completa corre sin correo configurado y limpia sesiones', async () => {
  const {env} = await setup();
  const admin = (await env.DB.prepare('SELECT id FROM users').first()).id;
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind('vieja', admin, 1).run();
  const result = await runScheduled(env, new Date('2026-11-02T11:00:00Z'));
  assert.equal(result.digests.sent, 0);
  assert.ok(result.backup.workspaces >= 1);
  assert.equal(await env.DB.prepare("SELECT 1 FROM sessions WHERE token_hash='vieja'").first(), null);
  const pending = [];
  await worker.scheduled({}, env, {waitUntil: p => pending.push(p)});
  await Promise.all(pending);
  env.DB.close();
});
