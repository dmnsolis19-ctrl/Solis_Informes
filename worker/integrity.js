// Huella de integridad de documentos emitidos y página pública de verificación.
import {sha256} from './auth.js';
import {escapeHtml as e} from '../public/js/domain.js';
import {formatCode} from '../public/js/verification.js';

/** JSON canónico: claves ordenadas, sin `undefined`. Mismo texto para el mismo contenido. */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => canonicalize(v === undefined ? null : v)).join(',') + ']';
  return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

/** Huella SHA-256 del informe sin su propio campo de integridad. */
export async function documentHash(report) {
  return sha256(canonicalize({...report, integrity: null}));
}

export async function makeIntegrity(report, at) {
  const hash = await documentHash(report);
  return {hash, code: hash.slice(0, 32), algorithm: 'SHA-256', at};
}

const page = (status, title, body) => new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(title)}</title><style>body{margin:0;background:#eef2f4;color:#243844;font:15px/1.6 Arial,Helvetica,sans-serif}main{max-width:560px;margin:8vh auto;padding:0 16px}.card{background:#fff;border:1px solid #d5dde2;border-radius:10px;padding:24px}h1{font-size:20px;margin:0 0 14px}dl{margin:16px 0 0}dt{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7c86;margin-top:12px}dd{margin:2px 0 0;font-weight:600}.badge{display:inline-block;padding:4px 10px;border-radius:99px;font-size:13px;font-weight:700}.ok{background:#e3f5ef;color:#0b6b57}.warn{background:#fdf1dc;color:#8a5a00}.bad{background:#fde7e7;color:#a12626}small{color:#6b7c86;display:block;margin-top:18px}</style></head><body><main><div class="card">${body}</div></main></body></html>`, {status, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=31536000', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});

const fmt = iso => { const t = Date.parse(iso); return Number.isFinite(t) ? new Intl.DateTimeFormat('es-CL', {timeZone: 'America/Santiago', dateStyle: 'long', timeStyle: 'short'}).format(new Date(t)) + ' (hora de Chile)' : '—'; };

/** Resultado de verificar un código: sin datos del cliente ni contenido del informe. */
export async function verifyDocument(env, code) {
  if (!/^[a-f0-9]{32}$/.test(code)) return {found: false};
  const row = await env.DB.prepare('SELECT * FROM document_integrity WHERE code=?').bind(code).first();
  if (!row) return {found: false};
  const entity = await env.DB.prepare("SELECT data,deleted FROM entities WHERE workspace_id=? AND kind='reports' AND id=?").bind(row.workspace_id, row.report_id).first();
  const info = {found: true, code, folio: row.folio, revision: row.revision, title: row.title, company: row.company_name, issuedAt: row.issued_at};
  if (!entity) return {...info, state: 'missing', intact: false};
  const data = JSON.parse(entity.data);
  info.intact = (await documentHash(data)) === row.hash && data.integrity?.hash === row.hash;
  info.archived = !!entity.deleted;
  const newer = await env.DB.prepare("SELECT revision FROM entities WHERE workspace_id=? AND kind='reports' AND folio=? AND revision>? AND deleted=0 AND json_extract(data,'$.status')='Emitido' ORDER BY revision DESC LIMIT 1").bind(row.workspace_id, row.folio, row.revision).first();
  info.supersededBy = newer?.revision ?? null;
  info.state = !info.intact ? 'altered' : info.archived ? 'archived' : info.supersededBy !== null ? 'superseded' : 'valid';
  return info;
}

export async function verificationPage(env, code) {
  const v = await verifyDocument(env, code);
  if (!v.found) return page(404, 'Documento no encontrado', '<h1>Documento no encontrado</h1><p>El código no corresponde a ningún documento emitido. Revisa que esté completo.</p><span class="badge bad">Sin coincidencia</span>');
  const badge = {valid: ['ok', 'Documento vigente e íntegro'], superseded: ['warn', `Íntegro, pero reemplazado por la revisión ${v.supersededBy}`], archived: ['warn', 'Íntegro, pero archivado por el emisor'], altered: ['bad', 'El registro no coincide con la huella emitida'], missing: ['bad', 'El registro ya no está disponible']}[v.state];
  return page(200, `Verificación ${v.folio}`, `<h1>Verificación de documento</h1><span class="badge ${badge[0]}">${e(badge[1])}</span><dl><dt>Emisor</dt><dd>${e(v.company)}</dd><dt>Documento</dt><dd>${e(v.title)}</dd><dt>Folio y revisión</dt><dd>${e(v.folio)} · Rev. ${v.revision}</dd><dt>Fecha de emisión</dt><dd>${e(fmt(v.issuedAt))}</dd><dt>Código</dt><dd style="font-family:monospace">${e(formatCode(v.code))}</dd></dl><small>Esta página confirma que el documento fue emitido con ese folio y que el registro emitido mantiene su huella SHA-256. No muestra su contenido. Si tienes un PDF impreso o guardado, compara el folio y la revisión con los de esta página.</small>`);
}
