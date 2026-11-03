import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {makeEnvironment} from '../scripts/local-bindings.mjs';
import {rateLimit} from '../worker/auth.js';

function request(path, body, cookie = '', method = body === undefined ? 'GET' : 'POST') {
  return new Request('https://solis.test' + path, {
    method,
    headers: {'Content-Type': 'application/json', 'X-Solis-Client': '5', ...(cookie ? {Cookie: cookie} : {})},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}
async function call(env, path, body, cookie = '', method) {
  const response = await worker.fetch(request(path, body, cookie, method), env, {waitUntil() {}});
  const type = response.headers.get('content-type') || '';
  return {response, status: response.status, value: type.includes('json') ? await response.json() : await response.text()};
}
async function setup() {
  const env = makeEnvironment();
  const result = await call(env, '/api/setup', {email: 'admin@example.test', password: 'testing-password-123', setupToken: env.SETUP_TOKEN});
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return {env, cookie: result.response.headers.get('Set-Cookie').split(';')[0]};
}

test('el límite de intentos es exacto, también con llamadas simultáneas', async () => {
  const env = makeEnvironment();
  const results = await Promise.all(Array.from({length: 10}, () => rateLimit(env, 'prueba:concurrente', 4)));
  assert.equal(results.filter(Boolean).length, 4);
  assert.equal(await rateLimit(env, 'prueba:concurrente', 4), false);
  assert.equal(await rateLimit(env, 'prueba:otra-clave', 4), true);
  env.DB.close();
});

test('respuestas de API y de archivos estáticos incluyen cabeceras de seguridad', async () => {
  const {env, cookie} = await setup();
  const api = await call(env, '/api/status', undefined, cookie);
  assert.match(api.response.headers.get('Strict-Transport-Security'), /max-age=\d+/);
  assert.match(api.response.headers.get('Permissions-Policy'), /camera=\(self\)/);
  const page = await call(env, '/');
  assert.match(page.response.headers.get('Strict-Transport-Security'), /max-age=\d+/);
  assert.match(page.response.headers.get('Permissions-Policy'), /geolocation=\(self\)/);
  assert.match(page.response.headers.get('Content-Security-Policy'), /script-src 'self'/);
  env.DB.close();
});

test('la ruta heredada /api/users ya no existe (la gestión pasa por /api/team)', async () => {
  const {env, cookie} = await setup();
  assert.equal((await call(env, '/api/users', undefined, cookie)).status, 404);
  assert.equal((await call(env, '/api/users', {email: 'otro@example.test', password: 'testing-password-123'}, cookie)).status, 404);
  assert.equal((await call(env, '/api/team', undefined, cookie)).status, 200);
  env.DB.close();
});

import {createSession, hashPassword, randomToken} from '../worker/auth.js';
import {newCompany, newReport, uid} from '../public/js/domain.js';
import {newCatalog} from '../public/js/catalogs.js';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTZkAAAAASUVORK5CYII=';
const pushItem = (env, cookie, kind, data, baseVersion = 0) =>
  call(env, '/api/sync/push', {kind, id: data.id, data, baseVersion, mutationId: uid(), deleted: false}, cookie);
async function technician(env, workspaceId, companies) {
  const id = uid(), salt = randomToken();
  await env.DB.prepare('INSERT INTO users(id,workspace_id,email,password_hash,salt,role,company_ids,customer_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(id, workspaceId, id + '@hardening.test', await hashPassword('testing-password-123', salt), salt, 'technician', JSON.stringify(companies), '', new Date().toISOString()).run();
  return (await createSession(id, env, 'https://solis.test')).split(';')[0];
}

test('archivos de archivos antiguos se autorizan una vez y quedan indexados en file_access', async () => {
  const {env, cookie} = await setup();
  const user = (await call(env, '/api/status', undefined, cookie)).value.user;
  const company = {...newCompany(), name: 'Empresa Uno'};
  const customer = {...newCatalog('customers', company.id), name: 'Cliente Uno'};
  assert.equal((await pushItem(env, cookie, 'companies', company)).status, 200);
  assert.equal((await pushItem(env, cookie, 'customers', customer)).status, 200);
  const tech = await technician(env, user.workspaceId, [company.id]);

  const uploaded = await call(env, '/api/assets', {dataUrl: png, companyId: company.id}, cookie);
  assert.equal(uploaded.status, 201);
  const ref = uploaded.value.ref, hash = ref.split('/').at(-1);
  assert.equal((await call(env, ref, undefined, tech)).status, 200, 'acceso directo por file_access');

  // Simula un archivo anterior a file_access: se borra el índice pero el informe lo referencia.
  await env.DB.prepare('DELETE FROM file_access WHERE hash=?').bind(hash).run();
  assert.equal((await call(env, ref, undefined, tech)).status, 404, 'sin referencia ni índice no hay acceso');
  const report = Object.assign(newReport('general', company, 'HD-' + uid()), {
    customerRef: customer.id, customerCompany: customer.name, site: 'Planta', technician: 'Responsable',
    objective: 'Evaluar', scope: 'Visual', workPerformed: 'Inspección realizada.', conclusions: 'Sin observaciones.',
    photos: [{id: uid(), caption: 'Evidencia', tag: '', dataUrl: ref}]
  });
  assert.equal((await pushItem(env, cookie, 'reports', report)).status, 200);
  await env.DB.prepare('DELETE FROM file_access WHERE hash=?').bind(hash).run();
  assert.equal((await call(env, ref, undefined, tech)).status, 200, 'acceso por referencia en un informe de su empresa');
  const row = await env.DB.prepare('SELECT company_id FROM file_access WHERE hash=?').bind(hash).first();
  assert.equal(row?.company_id, company.id, 'el acceso quedó indexado para la próxima vez');

  // Otro técnico sin la empresa no obtiene acceso.
  const outsider = await technician(env, user.workspaceId, ['otra-empresa']);
  assert.equal((await call(env, ref, undefined, outsider)).status, 404);
  env.DB.close();
});

test('varias fotografías se guardan en paralelo conservando orden y contenido', async () => {
  const {env, cookie} = await setup();
  const company = {...newCompany(), name: 'Empresa Paralela'};
  const customer = {...newCatalog('customers', company.id), name: 'Cliente'};
  await pushItem(env, cookie, 'companies', company);
  await pushItem(env, cookie, 'customers', customer);
  const report = Object.assign(newReport('general', company, 'PA-' + uid()), {
    customerRef: customer.id, customerCompany: customer.name, site: 'Planta', technician: 'Responsable',
    objective: 'Evaluar', scope: 'Visual', workPerformed: 'Inspección realizada.', conclusions: 'Sin observaciones.',
    photos: Array.from({length: 12}, (_, i) => ({id: uid(), caption: 'Foto ' + i, tag: '', dataUrl: png}))
  });
  const saved = await pushItem(env, cookie, 'reports', report);
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  const stored = JSON.parse((await env.DB.prepare("SELECT data FROM entities WHERE kind='reports' AND id=?").bind(report.id).first()).data);
  assert.equal(stored.photos.length, 12);
  assert.deepEqual(stored.photos.map(p => p.caption), Array.from({length: 12}, (_, i) => 'Foto ' + i));
  assert.ok(stored.photos.every(p => /^\/api\/assets\/[a-f0-9]{64}$/.test(p.dataUrl)));
  env.DB.close();
});

test('el asistente usa el modelo configurado y acota el contexto para no exceder la ventana del modelo', async () => {
  const {env, cookie} = await setup();
  let seen = null;
  env.AI = {async run(model, input) { seen = {model, size: input.messages[1].content.length}; return {response: 'Texto propuesto'}; }};
  const company = {...newCompany(), name: 'Empresa IA'};
  assert.equal((await pushItem(env, cookie, 'companies', company)).status, 200);
  const big = 'a'.repeat(18000);
  const body = {action: 'rewrite', target: 'diagnosis', context: {companyId: company.id, objective: big, scope: big, workPerformed: big, diagnosis: big, observations: big, title: 'T', template: 'general'}};
  assert.equal((await call(env, '/api/ai', body, cookie)).status, 200);
  assert.equal(seen.model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  assert.ok(seen.size < 40000, 'contexto de ' + seen.size + ' caracteres');
  env.AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';
  await call(env, '/api/ai', body, cookie);
  assert.equal(seen.model, '@cf/meta/llama-3.1-8b-instruct', 'AI_MODEL sigue mandando');
  env.DB.close();
});
