import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnvironment} from '../scripts/local-bindings.mjs';
import worker from '../worker/index.js';
import {base32Encode, base32Decode, hotp, totpCode, verifyTotp, otpauthUrl, hashRecovery, normalizeRecovery, newRecoveryCodes} from '../worker/totp.js';
import {createSession, hashPassword, randomToken} from '../worker/auth.js';
import {uid} from '../public/js/domain.js';

const PASSWORD = 'security-password-1';
async function call(env, path, body, cookie = '') {
  const response = await worker.fetch(new Request('https://solis.test' + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type': 'application/json', 'X-Solis-Client': '6', 'User-Agent': 'prueba/1.0', ...(cookie ? {Cookie: cookie} : {})}, body: body === undefined ? undefined : JSON.stringify(body)}), env, {waitUntil() {}});
  return {status: response.status, response, value: response.headers.get('Content-Type')?.includes('json') ? await response.json() : await response.text()};
}
async function setup() {
  const env = makeEnvironment(), first = await call(env, '/api/setup', {email: 'admin@security.test', password: PASSWORD, setupToken: env.SETUP_TOKEN});
  assert.equal(first.status, 201);
  return {env, cookie: first.response.headers.get('Set-Cookie').split(';')[0]};
}
const login = (env, code) => call(env, '/api/login', {email: 'admin@security.test', password: PASSWORD, ...(code !== undefined ? {code} : {})});

test('TOTP cumple los vectores de prueba del RFC 6238 y la codificación base32 del RFC 4648', async () => {
  const key = new TextEncoder().encode('12345678901234567890');
  assert.equal(await hotp(key, Math.floor(59 / 30), 8), '94287082');
  assert.equal(await hotp(key, Math.floor(1111111109 / 30), 8), '07081804');
  assert.equal(await hotp(key, Math.floor(1234567890 / 30), 8), '89005924');
  assert.equal(await totpCode(key, 59000), '287082');
  assert.equal(base32Encode(new TextEncoder().encode('foobar')), 'MZXW6YTBOI');
  assert.equal(new TextDecoder().decode(base32Decode('mzxw 6ytb-oi')), 'foobar');
  assert.throws(() => base32Decode('1!'), /inválido/);
});

test('ventana de ±30 s, sin reutilizar pasos y con formato estricto', async () => {
  const secret = base32Encode(new TextEncoder().encode('12345678901234567890')), now = 1_700_000_000_000;
  const key = base32Decode(secret), current = await totpCode(key, now);
  const step = Math.floor(now / 30000);
  assert.equal(await verifyTotp(secret, current, now), step);
  assert.equal(await verifyTotp(secret, await totpCode(key, now - 30000), now), step - 1);
  assert.equal(await verifyTotp(secret, await totpCode(key, now + 30000), now), step + 1);
  assert.equal(await verifyTotp(secret, await totpCode(key, now - 90000), now), null, 'fuera de la ventana');
  assert.equal(await verifyTotp(secret, current, now, step), null, 'paso ya utilizado');
  assert.equal(await verifyTotp(secret, '12345', now), null);
  assert.equal(await verifyTotp(secret, 'abcdef', now), null);
  assert.match(otpauthUrl({secret, email: 'a@b.cl'}), /^otpauth:\/\/totp\/SOLIS%20Field:a%40b\.cl\?secret=[A-Z2-7]+&issuer=SOLIS%20Field/);
});

test('activar la verificación en dos pasos: el acceso exige el código y los códigos de recuperación sirven una vez', async () => {
  const {env, cookie} = await setup();
  const begin = await call(env, '/api/2fa/setup', {}, cookie);
  assert.equal(begin.status, 200);
  const stored = (await env.DB.prepare('SELECT totp_secret FROM users').first()).totp_secret;
  assert.ok(stored && !stored.includes(begin.value.secret), 'el secreto se guarda cifrado');
  assert.equal((await call(env, '/api/2fa/enable', {code: '000000'}, cookie)).status, 400);
  const key = base32Decode(begin.value.secret);
  const enabled = await call(env, '/api/2fa/enable', {code: await totpCode(key)}, cookie);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.value));
  assert.equal(enabled.value.recovery.length, 8);
  assert.ok(enabled.value.recovery.every(c => /^[a-z2-9]{5}-[a-z2-9]{5}$/.test(c)));
  assert.equal((await call(env, '/api/status', undefined, cookie)).value.user.totpEnabled, true);
  assert.equal((await call(env, '/api/2fa/setup', {}, cookie)).status, 409);

  const missing = await login(env);
  assert.equal(missing.status, 401);
  assert.equal(missing.value.needsCode, true);
  assert.equal(missing.response.headers.get('Set-Cookie'), null);
  assert.equal((await login(env, '123456')).status, 401);
  const code = await totpCode(key, Date.now() + 30000);
  const ok = await login(env, code);
  assert.equal(ok.status, 200);
  assert.ok(ok.response.headers.get('Set-Cookie'));
  assert.equal((await login(env, code)).status, 401, 'el mismo código no se puede reutilizar');
  const wrongPassword = await call(env, '/api/login', {email: 'admin@security.test', password: 'otra-clave-123456', code});
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.value.needsCode, undefined, 'sin la contraseña no se revela el segundo paso');

  const [recovery] = enabled.value.recovery;
  assert.equal((await login(env, recovery.toUpperCase())).status, 200);
  assert.equal((await login(env, recovery)).status, 401, 'cada código de recuperación sirve una vez');
  assert.equal(JSON.parse((await env.DB.prepare('SELECT totp_recovery FROM users').first()).totp_recovery).length, 7);
  env.DB.close();
});

test('desactivar exige contraseña y un código válido', async () => {
  const {env, cookie} = await setup();
  const begin = await call(env, '/api/2fa/setup', {}, cookie), key = base32Decode(begin.value.secret);
  await call(env, '/api/2fa/enable', {code: await totpCode(key)}, cookie);
  assert.equal((await call(env, '/api/2fa/disable', {password: 'incorrecta-123456', code: await totpCode(key, Date.now() + 30000)}, cookie)).status, 401);
  assert.equal((await call(env, '/api/2fa/disable', {password: PASSWORD, code: '000000'}, cookie)).status, 401);
  const done = await call(env, '/api/2fa/disable', {password: PASSWORD, code: await totpCode(key, Date.now() + 30000)}, cookie);
  assert.equal(done.status, 200, JSON.stringify(done.value));
  const row = await env.DB.prepare('SELECT totp_enabled,totp_secret FROM users').first();
  assert.deepEqual([row.totp_enabled, row.totp_secret], [0, '']);
  assert.equal((await login(env)).status, 200, 'vuelve a entrar solo con la contraseña');
  env.DB.close();
});

test('los intentos con el código están limitados', async () => {
  const {env, cookie} = await setup();
  const begin = await call(env, '/api/2fa/setup', {}, cookie);
  await call(env, '/api/2fa/enable', {code: await totpCode(base32Decode(begin.value.secret))}, cookie);
  const results = [];
  for (let i = 0; i < 10; i++) results.push((await login(env, String(100000 + i))).status);
  assert.ok(results.includes(429), 'tras 8 intentos fallidos se bloquea: ' + results.join(','));
  env.DB.close();
});

test('requiere APP_SECRET o SETUP_TOKEN largo para guardar el secreto', async () => {
  const {env, cookie} = await setup();
  const original = env.SETUP_TOKEN;
  env.SETUP_TOKEN = 'corto';
  assert.equal((await call(env, '/api/2fa/setup', {}, cookie)).status, 503);
  env.APP_SECRET = 'clave-de-aplicacion-de-32-caracteres';
  assert.equal((await call(env, '/api/2fa/setup', {}, cookie)).status, 200);
  env.SETUP_TOKEN = original;
  env.DB.close();
});

test('códigos de recuperación: formato, normalización y hash estables', async () => {
  const codes = newRecoveryCodes(5);
  assert.equal(new Set(codes).size, 5);
  assert.equal(normalizeRecovery('ABCDE-fghjk'), 'abcdefghjk');
  assert.equal(await hashRecovery('ABCDE-fghjk'), await hashRecovery('abcdefghjk'));
});

test('registro de errores del dispositivo: exige sesión, trunca, limita y solo el administrador los lee', async () => {
  const {env, cookie} = await setup();
  assert.equal((await call(env, '/api/client-errors', {message: 'x'})).status, 401);
  assert.equal((await call(env, '/api/client-errors', {message: '  '}, cookie)).status, 400);
  const sent = await call(env, '/api/client-errors', {message: 'Falla'.repeat(300), stack: 's'.repeat(9000), url: 'https://solis.test/#x', version: '3.6.0', source: 'window'}, cookie);
  assert.equal(sent.status, 201);
  const listed = await call(env, '/api/client-errors', undefined, cookie);
  assert.equal(listed.value.errors.length, 1);
  assert.equal(listed.value.errors[0].message.length, 500);
  assert.equal(listed.value.errors[0].stack.length, 4000);
  assert.equal(listed.value.errors[0].email, 'admin@security.test');
  assert.equal(listed.value.errors[0].user_agent, 'prueba/1.0');
  const ws = (await env.DB.prepare('SELECT id FROM workspaces').first()).id, id = uid(), salt = randomToken();
  await env.DB.prepare('INSERT INTO users(id,workspace_id,email,password_hash,salt,role,company_ids,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, ws, 'tec@security.test', await hashPassword(PASSWORD, salt), salt, 'technician', '["*"]', new Date().toISOString()).run();
  const techCookie = (await createSession(id, env, 'https://solis.test')).split(';')[0];
  assert.equal((await call(env, '/api/client-errors', {message: 'Falla de técnico'}, techCookie)).status, 201);
  assert.equal((await call(env, '/api/client-errors', undefined, techCookie)).status, 403);
  for (let i = 0; i < 40; i++) await call(env, '/api/client-errors', {message: 'repetido ' + i}, cookie);
  assert.ok((await env.DB.prepare('SELECT COUNT(*) n FROM client_errors').first()).n <= 33, 'el límite por hora evita saturar el registro');
  env.DB.close();
});
