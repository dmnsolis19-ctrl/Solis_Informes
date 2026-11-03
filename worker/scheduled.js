// Tareas diarias: limpieza de enlaces caducados, respaldo de datos y resumen de pendientes por correo.
import {evaluateAlerts, latestReports} from '../public/js/operations.js';

const DAY = 86400000;
export const retention = {sharesAfterExpiryDays: 30, backupDays: 14};

const localDay = (date, timeZone) => new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(date);
const safeZone = zone => { try { new Intl.DateTimeFormat('en', {timeZone: zone}); return zone; } catch { return 'America/Santiago'; } };
const log = (step, error) => console.error('Tarea diaria fallida', step, error?.name, error?.message);

/** Borra los documentos copiados para enlaces caducados o revocados hace más de 30 días. */
export async function cleanupShares(env, now = Date.now()) {
  const limit = now - retention.sharesAfterExpiryDays * DAY;
  const rows = (await env.DB.prepare('SELECT token_hash,object_key FROM shares WHERE (expires_at<? OR revoked=1) AND expires_at<? LIMIT 200').bind(limit, now).all()).results;
  let removed = 0;
  for (const row of rows) {
    await env.BUCKET.delete(row.object_key);
    await env.DB.prepare('DELETE FROM shares WHERE token_hash=?').bind(row.token_hash).run();
    removed++;
  }
  return removed;
}

/** Exporta los registros de cada espacio a JSON en R2. Usa BACKUP_BUCKET si existe (destino aparte). */
export async function backupWorkspaces(env, now = new Date()) {
  const target = env.BACKUP_BUCKET || env.BUCKET, day = now.toISOString().slice(0, 10), summary = {day, workspaces: 0, objects: 0, items: 0};
  const workspaces = (await env.DB.prepare('SELECT id FROM workspaces').all()).results;
  for (const {id} of workspaces) {
    const prefix = `backups/${day}/${id}/`;
    if (await target.head(prefix + 'manifest.json')) continue;
    const counts = {};
    const put = async (name, payload) => { await target.put(prefix + name, JSON.stringify(payload), {httpMetadata: {contentType: 'application/json'}}); summary.objects++; };
    const kinds = (await env.DB.prepare('SELECT DISTINCT kind FROM entities WHERE workspace_id=?').bind(id).all()).results.map(r => r.kind);
    for (const kind of kinds) {
      for (let page = 0, offset = 0; ; page++, offset += 200) {
        const rows = (await env.DB.prepare('SELECT id,version,deleted,folio,revision,data,updated_at,updated_by FROM entities WHERE workspace_id=? AND kind=? ORDER BY id LIMIT 200 OFFSET ?').bind(id, kind, offset).all()).results;
        if (!rows.length) break;
        await put(`${kind}-${String(page).padStart(4, '0')}.json`, {format: 1, workspaceId: id, kind, exportedAt: now.toISOString(), items: rows.map(r => ({...r, data: JSON.parse(r.data)}))});
        counts[kind] = (counts[kind] || 0) + rows.length; summary.items += rows.length;
        if (rows.length < 200) break;
      }
    }
    const users = (await env.DB.prepare('SELECT id,email,role,active,company_ids,customer_id FROM users WHERE workspace_id=?').bind(id).all()).results;
    await put('users.json', {format: 1, workspaceId: id, exportedAt: now.toISOString(), users});
    await put('manifest.json', {format: 1, workspaceId: id, exportedAt: now.toISOString(), counts, users: users.length, note: 'Las fotografías y archivos viven en R2 bajo el espacio de trabajo y no se copian aquí.'});
    summary.workspaces++;
  }
  // Conserva solo los últimos N días.
  const keep = Math.max(1, Math.min(90, Number(env.BACKUP_KEEP_DAYS) || retention.backupDays));
  const listed = [];
  let cursor;
  do {
    const page = await target.list({prefix: 'backups/', cursor, limit: 1000});
    listed.push(...page.objects.map(o => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const days = [...new Set(listed.map(k => k.split('/')[1]))].sort().reverse();
  const old = new Set(days.slice(keep));
  const stale = listed.filter(k => old.has(k.split('/')[1]));
  for (let i = 0; i < stale.length; i += 500) await target.delete(stale.slice(i, i + 500));
  summary.deleted = stale.length;
  return summary;
}

const allowedFor = (user, companyId) => user.role === 'admin' || user.companyIds.includes('*') || user.companyIds.includes(companyId);
const more = (items, max, line) => items.slice(0, max).map(line).concat(items.length > max ? [`  … y ${items.length - max} más`] : []);

/** Arma el resumen de un usuario. Devuelve null si no hay nada que avisar. */
export function buildDigest(user, data, today, nowMs) {
  const alerts = evaluateAlerts(latestReports(data.reports.filter(r => allowedFor(user, r.companyId))), data.tasks.filter(t => allowedFor(user, t.companyId)), data.rules.filter(r => allowedFor(user, r.companyId)), today).filter(a => allowedFor(user, a.companyId));
  const weekAhead = localDay(new Date(nowMs + 7 * DAY), data.timeZone);
  const orders = data.orders.filter(o => allowedFor(user, o.companyId) && ['Planificada', 'En curso'].includes(o.status) && o.dueDate && o.dueDate <= weekAhead).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const shares = data.shares.filter(s => s.created_by === user.id);
  if (!alerts.length && !orders.length && !shares.length) return null;
  const sections = [];
  if (alerts.length) sections.push(`Alertas (${alerts.length})\n` + more(alerts, 15, a => `  • [${a.priority}] ${a.title} — ${a.detail}`).join('\n'));
  if (orders.length) sections.push(`Órdenes y mantenimientos (${orders.length})\n` + more(orders, 15, o => `  • ${o.dueDate < today ? 'VENCIDA ' : ''}${o.dueDate} · ${o.name || 'Sin nombre'}${o.owner ? ' · ' + o.owner : ''}`).join('\n'));
  if (shares.length) sections.push(`Enlaces compartidos que vencen en 3 días (${shares.length})\n` + more(shares, 10, s => `  • Informe ${s.report_id.slice(0, 8)} — vence el ${localDay(new Date(s.expires_at), data.timeZone)}`).join('\n'));
  const total = alerts.length + orders.length + shares.length;
  return {total, subject: `Resumen diario · ${total} ${total === 1 ? 'punto pendiente' : 'puntos pendientes'}`, text: `Hola,\n\nEste es tu resumen de pendientes al ${today}.\n\n${sections.join('\n\n')}\n\n${data.appUrl ? 'Abre la aplicación: ' + data.appUrl + '\n\n' : ''}Mensaje automático de ${data.appName}.`};
}

export async function sendDigests(env, now = new Date()) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || env.DIGEST_ENABLED === 'false') return {sent: 0, skipped: 'sin correo configurado o desactivado'};
  const timeZone = safeZone(env.TIMEZONE || 'America/Santiago'), today = localDay(now, timeZone);
  let sent = 0;
  for (const {id: workspaceId} of (await env.DB.prepare('SELECT id FROM workspaces').all()).results) {
    const load = async kind => (await env.DB.prepare("SELECT data FROM entities WHERE workspace_id=? AND kind=? AND deleted=0 LIMIT 5000").bind(workspaceId, kind).all()).results.map(r => JSON.parse(r.data));
    const data = {reports: await load('reports'), tasks: await load('tasks'), orders: await load('workOrders'), rules: (await load('alertRules')).filter(r => r.status === 'Activa'), timeZone, appUrl: env.APP_URL || '', appName: env.APP_NAME || 'SOLIS Field',
      shares: (await env.DB.prepare('SELECT created_by,report_id,expires_at FROM shares WHERE workspace_id=? AND revoked=0 AND expires_at>? AND expires_at<?').bind(workspaceId, now.getTime(), now.getTime() + 3 * DAY).all()).results};
    const users = (await env.DB.prepare("SELECT id,email,role,company_ids FROM users WHERE workspace_id=? AND active=1 AND role!='client'").bind(workspaceId).all()).results;
    for (const row of users) {
      const user = {id: row.id, email: row.email, role: row.role, companyIds: JSON.parse(row.company_ids || '["*"]')};
      const digest = buildDigest(user, data, today, now.getTime());
      if (!digest) continue;
      const claim = await env.DB.prepare("INSERT OR IGNORE INTO notification_log(user_id,day,kind,sent_at) VALUES(?,?,'digest',?)").bind(user.id, today, now.toISOString()).run();
      if (!claim.meta.changes) continue;
      try {
        const response = await fetch('https://api.resend.com/emails', {method: 'POST', headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `digest:${user.id}:${today}`}, body: JSON.stringify({from: env.EMAIL_FROM, to: [user.email], subject: digest.subject, text: digest.text})});
        if (!response.ok) throw new Error('El proveedor rechazó el correo (' + response.status + ').');
        sent++;
      } catch (error) {
        await env.DB.prepare("DELETE FROM notification_log WHERE user_id=? AND day=? AND kind='digest'").bind(user.id, today).run();
        log('digest', error);
      }
    }
  }
  return {sent};
}

export async function runScheduled(env, now = new Date()) {
  if (!env.DB) return {};
  const result = {};
  await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now.getTime()), env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now.getTime() - DAY), env.DB.prepare('DELETE FROM client_errors WHERE created_at<?').bind(new Date(now.getTime() - 30 * DAY).toISOString())]);
  if (env.BUCKET) {
    try { result.sharesRemoved = await cleanupShares(env, now.getTime()); } catch (error) { log('shares', error); }
    try { result.backup = await backupWorkspaces(env, now); } catch (error) { log('backup', error); }
  }
  try { result.digests = await sendDigests(env, now); } catch (error) { log('digests', error); }
  return result;
}
