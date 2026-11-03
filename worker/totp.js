// Verificación en dos pasos (TOTP, RFC 6238) con WebCrypto. Sin dependencias.
import {sha256, constantEqual, hashPassword} from './auth.js';
import {fail} from './validation.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_MS = 30000;
const encoder = new TextEncoder();

export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Secreto inválido.');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export async function hotp(keyBytes, counter, digits = 6) {
  const key = await crypto.subtle.importKey('raw', keyBytes, {name: 'HMAC', hash: 'SHA-1'}, false, ['sign']);
  const message = new ArrayBuffer(8), view = new DataView(message);
  view.setUint32(0, Math.floor(counter / 2 ** 32)); view.setUint32(4, counter >>> 0);
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message)), offset = hmac[19] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}
export const totpStep = (nowMs = Date.now()) => Math.floor(nowMs / STEP_MS);
export const totpCode = (keyBytes, nowMs = Date.now()) => hotp(keyBytes, totpStep(nowMs));

/** Devuelve el paso del código válido (ventana de ±1 paso) o null. Rechaza pasos ya usados. */
export async function verifyTotp(secretBase32, code, nowMs = Date.now(), lastStep = 0, window = 1) {
  if (!/^\d{6}$/.test(String(code))) return null;
  const key = base32Decode(secretBase32), current = totpStep(nowMs);
  let found = null;
  for (let delta = -window; delta <= window; delta++) {
    const step = current + delta;
    if (step <= lastStep) continue;
    if (constantEqual(await hotp(key, step), String(code)) && found === null) found = step;
  }
  return found;
}

export const newSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));
export const otpauthUrl = ({secret, email, issuer = 'SOLIS Field'}) => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// Cifrado del secreto en reposo (AES-GCM). La clave sale de APP_SECRET o, en su defecto, de SETUP_TOKEN.
async function aesKey(env) {
  const secret = env.APP_SECRET || env.SETUP_TOKEN;
  if (!secret || secret.length < 20) fail(503, 'Configura APP_SECRET (o SETUP_TOKEN) con al menos 20 caracteres para activar la verificación en dos pasos.');
  return crypto.subtle.importKey('raw', encoder.encode(await sha256('solis-totp:' + secret)).slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const toBase64 = bytes => btoa(String.fromCharCode(...bytes));
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export async function encryptText(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), data = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await aesKey(env), encoder.encode(text)));
  return toBase64(new Uint8Array([...iv, ...data]));
}
export async function decryptText(env, blob) {
  const bytes = fromBase64(blob);
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes.slice(0, 12)}, await aesKey(env), bytes.slice(12))); }
  catch { fail(500, 'No se pudo leer el secreto de verificación. Si cambiaste APP_SECRET o SETUP_TOKEN, desactiva y vuelve a activar el segundo paso.'); }
}

const recoveryAlphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newRecoveryCodes(count = 8) {
  return Array.from({length: count}, () => { const bytes = crypto.getRandomValues(new Uint8Array(10)); const text = [...bytes].map(b => recoveryAlphabet[b % recoveryAlphabet.length]).join(''); return text.slice(0, 5) + '-' + text.slice(5); });
}
export const normalizeRecovery = code => String(code).toLowerCase().replace(/[^a-z0-9]/g, '');
export const hashRecovery = code => sha256('recovery:' + normalizeRecovery(code));

/** Comprueba el segundo factor (código TOTP o de recuperación). Devuelve {ok,message}. */
export async function checkSecondFactor(env, user, code, {rateLimit}) {
  const value = String(code || '').trim();
  if (!value) return {ok: false, message: 'Ingresa el código de verificación de tu aplicación.'};
  if (!(await rateLimit(env, 'totp:' + user.id, 8))) fail(429, 'Demasiados intentos con el código. Espera antes de volver a intentar.');
  if (/^\d{6}$/.test(value)) {
    const step = await verifyTotp(await decryptText(env, user.totp_secret), value, Date.now(), user.totp_last_step);
    if (step !== null) {
      const result = await env.DB.prepare('UPDATE users SET totp_last_step=? WHERE id=? AND totp_last_step<?').bind(step, user.id, step).run();
      if (result.meta.changes) return {ok: true};
    }
    return {ok: false, message: 'Código incorrecto o ya utilizado.'};
  }
  const hash = await hashRecovery(value), list = JSON.parse(user.totp_recovery || '[]');
  if (normalizeRecovery(value).length === 10 && list.includes(hash)) {
    const result = await env.DB.prepare('UPDATE users SET totp_recovery=? WHERE id=? AND totp_recovery=?').bind(JSON.stringify(list.filter(h => h !== hash)), user.id, user.totp_recovery).run();
    if (result.meta.changes) return {ok: true, usedRecovery: true};
  }
  return {ok: false, message: 'Código incorrecto o ya utilizado.'};
}
export {hashPassword};
