import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnvironment} from '../scripts/local-bindings.mjs';
import worker from '../worker/index.js';
import {newCompany, newReport, uid, reviseReport} from '../public/js/domain.js';
import {newCatalog} from '../public/js/catalogs.js';
import {canonicalize, documentHash} from '../worker/integrity.js';
import {renderDocument} from '../public/js/render.js';
import {verificationUrl, qrMarkup, formatCode} from '../public/js/verification.js';

async function call(env, path, body, cookie = '', headers = {}) {
  const response = await worker.fetch(new Request('https://solis.test' + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', 'X-Solis-Client': '6', ...(cookie ? {Cookie: cookie} : {}), ...headers}, body: body === undefined ? undefined : JSON.stringify(body)}), env, {waitUntil() {}});
  const json = response.headers.get('Content-Type')?.includes('json');
  return {status: response.status, response, value: json ? await response.json() : await response.text()};
}
const push = (env, cookie, kind, data, version = 0) => call(env, '/api/sync/push', {kind, id: data.id, data, baseVersion: version, mutationId: uid(), deleted: false}, cookie);
async function setup() {
  const env = makeEnvironment(), first = await call(env, '/api/setup', {email: 'admin@verify.test', password: 'verification-password-1', setupToken: env.SETUP_TOKEN});
  assert.equal(first.status, 201);
  const company = {...newCompany(), name: 'Empresa Verificable SpA'}, customer = {...newCatalog('customers', company.id), name: 'Cliente Reservado'};
  const cookie = first.response.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await push(env, cookie, 'companies', company)).status, 200);
  assert.equal((await push(env, cookie, 'customers', customer)).status, 200);
  return {env, cookie, company, customer};
}
const report = (c, customer, folio) => Object.assign(newReport('general', c, folio), {customerRef: customer.id, customerCompany: customer.name, site: 'Planta', technician: 'Responsable', objective: 'Evaluar la condición', scope: 'Inspección visual', workPerformed: 'Se inspeccionó el conjunto.', conclusions: 'Se registró la condición observada.', title: 'Informe de inspección'});
async function change(env, cookie, id, status, version) { return call(env, `/api/reports/${id}/transition`, {status, expectedVersion: version, requestId: uid()}, cookie); }
async function emit(env, cookie, r, version = 0) {
  assert.equal((await push(env, cookie, 'reports', r, version)).status, 200);
  for (const [status, v] of [['En revisión', 1], ['Aprobado', 2], ['Emitido', 3]]) { const x = await change(env, cookie, r.id, status, v); assert.equal(x.status, 200, JSON.stringify(x.value)); }
  return JSON.parse((await env.DB.prepare("SELECT data FROM entities WHERE kind='reports' AND id=?").bind(r.id).first()).data);
}

test('JSON canónico es estable sin importar el orden de claves', async () => {
  assert.equal(canonicalize({b: 1, a: [3, {d: 1, c: undefined}]}), canonicalize({a: [3, {d: 1}], b: 1}));
  assert.equal(await documentHash({a: 1, b: 2, integrity: {hash: 'x'}}), await documentHash({b: 2, a: 1}));
});

test('al emitir se registra la huella y la página pública confirma integridad sin exponer contenido', async () => {
  const {env, cookie, company, customer} = await setup(), r = report(company, customer, 'VF-2026-001');
  const issued = await emit(env, cookie, r);
  assert.match(issued.integrity.code, /^[a-f0-9]{32}$/);
  assert.equal(issued.integrity.algorithm, 'SHA-256');
  const page = await call(env, '/v/' + issued.integrity.code);
  assert.equal(page.status, 200);
  assert.match(page.value, /Documento vigente e íntegro/);
  assert.ok(page.value.includes('VF-2026-001') && page.value.includes('Empresa Verificable SpA'));
  assert.ok(!page.value.includes('Cliente Reservado') && !page.value.includes('Se inspeccionó'), 'no filtra el contenido');
  assert.equal(page.response.headers.get('X-Frame-Options'), 'DENY');
  assert.match(page.response.headers.get('Content-Security-Policy'), /default-src 'none'/);
  assert.equal(page.response.headers.get('Cache-Control'), 'no-store');
  env.DB.close();
});

test('detecta modificaciones del registro, revisiones posteriores y códigos inexistentes', async () => {
  const {env, cookie, company, customer} = await setup(), r = report(company, customer, 'VF-2026-002');
  const issued = await emit(env, cookie, r), code = issued.integrity.code;
  const revision = reviseReport(issued);
  assert.equal(revision.integrity, null);
  assert.equal(await emit(env, cookie, revision).then(x => x.revision), 1);
  assert.match((await call(env, '/v/' + code)).value, /reemplazado por la revisión 1/);
  await env.DB.prepare("UPDATE entities SET version=version+1,data=replace(data,'Se inspeccionó el conjunto.','Texto alterado') WHERE kind='reports' AND id=?").bind(r.id).run();
  assert.match((await call(env, '/v/' + code)).value, /no coincide con la huella/);
  assert.equal((await call(env, '/v/' + 'a'.repeat(32))).status, 404);
  assert.equal((await call(env, '/v/corto')).status, 404);
  env.DB.close();
});

test('el cliente no puede falsificar la huella desde un borrador', async () => {
  const {env, cookie, company, customer} = await setup(), r = report(company, customer, 'VF-2026-003');
  r.integrity = {hash: 'a'.repeat(64), code: 'a'.repeat(32), algorithm: 'SHA-256', at: new Date().toISOString()};
  assert.equal((await push(env, cookie, 'reports', r)).status, 200);
  const stored = JSON.parse((await env.DB.prepare("SELECT data FROM entities WHERE kind='reports' AND id=?").bind(r.id).first()).data);
  assert.equal(stored.integrity, null);
  assert.equal((await call(env, '/v/' + 'a'.repeat(32))).status, 404);
  env.DB.close();
});

test('el documento emitido incluye un QR y el código; la fecha de firma se muestra', async () => {
  const {env, cookie, company, customer} = await setup(), r = report(company, customer, 'VF-2026-004');
  r.clientSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTZkAAAAASUVORK5CYII=';
  r.clientSignedAt = '2026-10-01T15:30:00.000Z';
  const issued = await emit(env, cookie, r);
  const html = renderDocument(issued, '', {origin: 'https://solis.test'});
  assert.ok(html.includes('doc-verify') && html.includes('<svg') && html.includes(verificationUrl('https://solis.test', issued.integrity.code)));
  assert.ok(html.includes(formatCode(issued.integrity.code)));
  assert.match(html, /Firmado el 01\/10\/2026 12:30/);
  assert.ok(!renderDocument(issued, '').includes('doc-verify'), 'sin origen no hay QR');
  assert.ok(!renderDocument({...issued, integrity: null}, '', {origin: 'https://solis.test'}).includes('doc-verify'), 'un borrador no tiene QR');
  assert.match(qrMarkup('https://solis.test/v/abc'), /^<svg[\s\S]*<path d="M/);
  env.DB.close();
});

test('un enlace compartido muestra el código de verificación del documento emitido', async () => {
  const {env, cookie, company, customer} = await setup(), r = report(company, customer, 'VF-2026-005');
  const issued = await emit(env, cookie, r);
  const share = await call(env, '/api/shares', {reportId: r.id, expiresDays: 7}, cookie);
  assert.equal(share.status, 201);
  const shared = await call(env, new URL(share.value.url).pathname);
  assert.equal(shared.status, 200);
  assert.ok(shared.value.includes('doc-verify') && shared.value.includes('/v/' + issued.integrity.code));
  env.DB.close();
});
