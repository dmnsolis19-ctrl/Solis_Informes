// Interfaz de seguridad: verificación en dos pasos y registro de errores de los dispositivos.
import {escapeHtml as e} from './domain.js';
import {api, syncState, checkSession} from './sync.js';
import {qrMarkup} from './verification.js';
import {APP_VERSION} from './version.js';

export function securityButtons(user) {
  return `<button class="text-btn" data-action="twofa">Verificación en dos pasos${user.totpEnabled ? ' · activada' : ''}</button>${user.role === 'admin' ? '<button class="text-btn" data-action="client-errors">Errores de dispositivos</button>' : ''}`;
}

const noise = /Failed to fetch|NetworkError|Load failed|ResizeObserver loop|AbortError|The operation was aborted/i;
const reported = new Set();
let reporting = false;
/** Envía al servidor (sin interrumpir al usuario) los errores inesperados de este dispositivo. */
export function reportClientError(error, source = 'window') {
  try {
    const message = String(error?.message || error || '').trim();
    if (!message || noise.test(message) || reporting || reported.size >= 10 || reported.has(message) || !navigator.onLine || !syncState.user) return;
    reported.add(message); reporting = true;
    api('/api/client-errors', {message, source, stack: String(error?.stack || ''), url: location.origin + location.pathname, version: APP_VERSION}).catch(() => {}).finally(() => { reporting = false; });
  } catch { reporting = false; }
}

export async function handleSecurityAction(button, ctx) {
  const a = button.dataset.action;
  if (!['twofa', 'twofa-enable', 'twofa-disable', 'twofa-start', 'client-errors'].includes(a)) return false;
  const user = syncState.user;
  if (!user || !navigator.onLine) throw new Error('Inicia sesión y conéctate para administrar la seguridad de tu cuenta.');

  if (a === 'twofa') {
    if (user.totpEnabled) {
      ctx.modal('Verificación en dos pasos', `<p>La verificación en dos pasos está <b>activada</b>. Al iniciar sesión se pedirá un código de tu aplicación de autenticación.</p><p class="muted">Para desactivarla confirma tu contraseña y un código vigente (o un código de recuperación).</p><div class="form-grid"><label class="field wide"><span>Contraseña</span><input id="twofa-password" type="password" autocomplete="current-password"></label><label class="field wide"><span>Código de 6 dígitos o de recuperación</span><input id="twofa-code" autocomplete="one-time-code"></label></div><div class="modal-actions"><button class="btn danger" data-action="twofa-disable">Desactivar</button></div>`);
    } else {
      ctx.modal('Verificación en dos pasos', `<p>Protege tu cuenta con un segundo paso: un código de 6 dígitos que cambia cada 30 segundos y se genera en tu teléfono (Google Authenticator, Microsoft Authenticator, Aegis u otra aplicación TOTP).</p><div class="modal-actions"><button class="btn primary" data-action="twofa-start">Comenzar</button></div>`);
    }
    return true;
  }
  if (a === 'twofa-start') {
    const setup = await api('/api/2fa/setup', {});
    ctx.modal('Activar verificación en dos pasos', `<ol><li>Escanea el código con tu aplicación de autenticación o ingresa la clave manualmente.</li><li>Escribe el código de 6 dígitos que muestra la aplicación.</li></ol><div class="twofa-qr" style="max-width:200px;margin:12px auto">${qrMarkup(setup.otpauth, 'Código QR para la aplicación de autenticación')}</div><p class="muted" style="text-align:center">Clave manual: <code>${e(setup.secret.match(/.{1,4}/g).join(' '))}</code></p><div class="form-grid"><label class="field wide"><span>Código de 6 dígitos</span><input id="twofa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label></div><div class="modal-actions"><button class="btn primary" data-action="twofa-enable">Activar</button></div>`);
    return true;
  }
  if (a === 'twofa-enable') {
    const result = await api('/api/2fa/enable', {code: document.querySelector('#twofa-code').value.trim()});
    await checkSession();
    ctx.modal('Códigos de recuperación', `<p><b>Guárdalos ahora en un lugar seguro.</b> Cada código permite entrar una vez si pierdes tu teléfono. No volverán a mostrarse.</p><pre class="recovery-codes" style="font-size:16px;line-height:1.8;background:#f2f5f7;padding:12px;border-radius:8px">${result.recovery.map(c => e(c)).join('\n')}</pre><div class="modal-actions"><button class="btn primary" data-action="close-modal">Ya los guardé</button></div>`);
    ctx.render();
    return true;
  }
  if (a === 'twofa-disable') {
    await api('/api/2fa/disable', {password: document.querySelector('#twofa-password').value, code: document.querySelector('#twofa-code').value.trim()});
    await checkSession();
    ctx.closeModal(); ctx.render(); ctx.toast('Verificación en dos pasos desactivada.');
    return true;
  }
  if (a === 'client-errors') {
    const {errors} = await api('/api/client-errors');
    const rows = errors.map(r => `<tr><td>${e(r.created_at.slice(0, 16).replace('T', ' '))}</td><td>${e(r.email || '')}</td><td>${e(r.app_version)}</td><td><b>${e(r.message.slice(0, 160))}</b><br><small>${e(r.user_agent.slice(0, 80))}</small></td></tr>`).join('');
    ctx.modal('Errores recientes de los dispositivos', errors.length ? `<div class="table-scroll"><table class="ops-table"><thead><tr><th>Fecha (UTC)</th><th>Usuario</th><th>Versión</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No hay errores registrados. Los dispositivos con sesión iniciada envían aquí los fallos inesperados de la aplicación.</p>', {wide: true});
    return true;
  }
  return false;
}
