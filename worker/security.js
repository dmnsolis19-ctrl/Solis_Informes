// Rutas de seguridad: verificación en dos pasos y registro de errores de los dispositivos.
import {fail, jsonBody} from './validation.js';
import {rateLimit, constantEqual, hashPassword} from './auth.js';
import {newSecret, otpauthUrl, encryptText, decryptText, verifyTotp, newRecoveryCodes, hashRecovery, checkSecondFactor} from './totp.js';

const clip = (value, max) => String(value ?? '').slice(0, max);

export async function securityRoute(req, env, user, url, s) {
  const path = url.pathname;
  if (!path.startsWith('/api/2fa/') && !path.startsWith('/api/client-errors')) return null;

  if (path === '/api/client-errors' && req.method === 'POST') {
    if (!(await rateLimit(env, 'client-errors:' + user.id, 30, 3600000))) return s.json({ok: true, dropped: true}, 202);
    const b = await jsonBody(req, 12000);
    const message = clip(b.message, 500).trim();
    if (!message) fail(400, 'Falta el mensaje del error.');
    await env.DB.prepare('INSERT INTO client_errors(workspace_id,user_id,message,source,stack,url,user_agent,app_version,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(user.workspaceId, user.id, message, clip(b.source, 100), clip(b.stack, 4000), clip(b.url, 300), clip(req.headers.get('User-Agent'), 300), clip(b.version, 20), new Date().toISOString()).run();
    await env.DB.prepare('DELETE FROM client_errors WHERE workspace_id=? AND id<=COALESCE((SELECT id FROM client_errors WHERE workspace_id=? ORDER BY id DESC LIMIT 1 OFFSET 500),0)').bind(user.workspaceId, user.workspaceId).run();
    return s.json({ok: true}, 201);
  }
  if (path === '/api/client-errors' && req.method === 'GET') {
    if (user.role !== 'admin') fail(403, 'Solo el administrador puede ver los errores de los dispositivos.');
    const rows = (await env.DB.prepare('SELECT c.id,c.message,c.source,c.stack,c.url,c.user_agent,c.app_version,c.created_at,u.email FROM client_errors c LEFT JOIN users u ON u.id=c.user_id WHERE c.workspace_id=? ORDER BY c.id DESC LIMIT 100').bind(user.workspaceId).all()).results;
    return s.json({errors: rows});
  }

  if (path.startsWith('/api/2fa/') && req.method === 'POST') {
    const row = await env.DB.prepare('SELECT * FROM users WHERE id=? AND active=1').bind(user.id).first();
    if (!row) fail(401, 'Inicia sesión nuevamente.');
    if (path === '/api/2fa/setup') {
      if (row.totp_enabled) fail(409, 'La verificación en dos pasos ya está activada.');
      const secret = newSecret();
      await env.DB.prepare('UPDATE users SET totp_secret=?,totp_enabled=0,totp_last_step=0,totp_recovery=? WHERE id=?').bind(await encryptText(env, secret), '[]', user.id).run();
      return s.json({secret, otpauth: otpauthUrl({secret, email: row.email})});
    }
    if (path === '/api/2fa/enable') {
      if (!(await rateLimit(env, 'totp-enable:' + user.id, 10))) fail(429, 'Demasiados intentos. Espera antes de volver a intentar.');
      if (row.totp_enabled || !row.totp_secret) fail(409, 'Inicia la activación primero.');
      const b = await jsonBody(req, 2000), step = await verifyTotp(await decryptText(env, row.totp_secret), String(b.code || '').trim());
      if (step === null) fail(400, 'El código no coincide. Revisa la hora de tu teléfono e inténtalo de nuevo.');
      const codes = newRecoveryCodes(), hashes = await Promise.all(codes.map(hashRecovery));
      await env.DB.prepare('UPDATE users SET totp_enabled=1,totp_last_step=?,totp_recovery=? WHERE id=?').bind(step, JSON.stringify(hashes), user.id).run();
      return s.json({ok: true, recovery: codes});
    }
    if (path === '/api/2fa/disable') {
      if (!row.totp_enabled) fail(409, 'La verificación en dos pasos no está activada.');
      const b = await jsonBody(req, 2000), password = String(b.password || '');
      if (!(await rateLimit(env, 'totp-disable:' + user.id, 8))) fail(429, 'Demasiados intentos. Espera antes de volver a intentar.');
      if (!constantEqual(await hashPassword(password, row.salt), row.password_hash)) fail(401, 'Contraseña incorrecta.');
      const check = await checkSecondFactor(env, row, b.code, {rateLimit});
      if (!check.ok) fail(401, check.message);
      await env.DB.prepare("UPDATE users SET totp_enabled=0,totp_secret='',totp_last_step=0,totp_recovery='[]' WHERE id=?").bind(user.id).run();
      return s.json({ok: true});
    }
  }
  return null;
}
