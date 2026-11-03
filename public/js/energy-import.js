// Importación de datos de energía y procesos desde CSV (SOLIS Energy, Node-RED, VRM u otros registradores).
// Funciones puras: se prueban sin navegador. El resultado son gráficos listos para guardar en el informe.
import {downsample, chartLimits, normalizeCharts, validTimeZone} from './charts.js';

export const importLimits = {maxBytes: 5_000_000, maxRows: 200_000, maxColumns: 40};

/** Divide un CSV en filas respetando comillas. Detecta coma, punto y coma o tabulación. */
export function parseCsv(text) {
  if (typeof text !== 'string') throw new Error('Archivo ilegible.');
  if (text.length > importLimits.maxBytes) throw new Error('El archivo supera 5 MB. Exporta un periodo menor.');
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = [';', '\t', ','].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
      if (rows.length > importLimits.maxRows) throw new Error('El archivo tiene demasiadas filas.');
    } else cell += c;
  }
  row.push(cell);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  if (rows.length < 3) throw new Error('El archivo necesita una fila de encabezados y al menos dos filas de datos.');
  const headers = rows[0].map((h, i) => h.trim() || `Columna ${i + 1}`);
  if (headers.length > importLimits.maxColumns) throw new Error('El archivo tiene demasiadas columnas.');
  return {headers, rows: rows.slice(1).map(r => headers.map((_, i) => (r[i] ?? '').trim())), delimiter};
}

/** Convierte "1.234,5", "1,234.5", "12,5" o "12.5 kW" en número, o null. */
export function parseNumber(value) {
  if (typeof value !== 'string') return null;
  let s = value.trim().replace(/\s/g, '');
  const match = s.match(/^[-+]?[\d.,]+(?:[eE][-+]?\d+)?/);
  if (!match) return null;
  s = match[0];
  const comma = s.lastIndexOf(','), dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) s = comma > dot ? s.replaceAll('.', '').replace(',', '.') : s.replaceAll(',', '');
  else if (comma >= 0) s = s.split(',').length > 2 ? s.replaceAll(',', '') : s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replaceAll('.', '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function offsetAt(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
/** Hora local de una zona (sin desfase en el texto) → milisegundos UTC. */
export function zonedToEpoch(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let result = guess - offsetAt(guess, tz);
  result = guess - offsetAt(result, tz);
  return result;
}

/** Interpreta una marca de tiempo. Texto sin zona se toma en `tz`. Devuelve milisegundos UTC o null. */
export function parseTimestamp(value, tz = 'UTC') {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  if (/^\d{10}(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
  if (/^\d{13}$/.test(s)) return Number(s);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', sec = '0', zone] = m;
    if (zone) { const t = Date.parse(`${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi.padStart(2, '0')}:${sec.padStart(2, '0')}${zone === 'z' || zone === 'Z' ? 'Z' : zone.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')}`); return Number.isFinite(t) ? t : null; }
    return zonedToEpoch(+y, +mo, +d, +h, +mi, +sec, tz);
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, d, mo, y, h = '0', mi = '0', sec = '0'] = m;
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
    return zonedToEpoch(+y, +mo, +d, +h, +mi, +sec, tz);
  }
  return null;
}

const timeNames = /^(time|timestamp|datetime|date[_ ]?time|fecha[_ ]?hora|fecha|date|hora|tiempo)\b/i;
/** Propone columnas de tiempo y de valores a partir de los encabezados y los primeros datos. */
export function detectColumns(headers, rows, tz = 'UTC') {
  const sample = rows.slice(0, 50);
  const stats = headers.map((h, i) => {
    const values = sample.map(r => r[i]).filter(v => v !== '');
    const stamps = values.filter(v => parseTimestamp(v, tz) !== null).length, nums = values.filter(v => parseNumber(v) !== null).length;
    return {i, name: h, values: values.length, timeRatio: values.length ? stamps / values.length : 0, numRatio: values.length ? nums / values.length : 0};
  });
  const timeCandidates = stats.filter(s => s.timeRatio >= 0.7);
  const named = timeCandidates.find(s => timeNames.test(s.name)) || timeCandidates[0];
  let timeCol = named ? named.i : -1, dateCol = -1;
  // Fecha y hora en columnas separadas (p. ej. «Fecha» y «Hora»): la columna de fecha no trae la hora.
  const dateOnly = named && /^(date|fecha)$/i.test(named.name.trim()) && !sample.some(r => /:/.test(r[named.i]));
  if (timeCol < 0 || dateOnly) {
    const d = dateOnly ? named.i : headers.findIndex(h => /^(date|fecha)$/i.test(h.trim())), t = headers.findIndex(h => /^(time|hora)$/i.test(h.trim()));
    if (d >= 0 && t >= 0 && sample.filter(r => parseTimestamp(`${r[d]} ${r[t]}`, tz) !== null).length >= sample.length * 0.7) { dateCol = d; timeCol = t; }
  }
  const valueCols = stats.filter(s => s.i !== timeCol && s.i !== dateCol && s.numRatio >= 0.7 && s.timeRatio < 0.5).map(s => s.i);
  return {timeCol, dateCol, valueCols};
}

/** Extrae una unidad entre paréntesis o corchetes: "Potencia (kW)" → "kW". */
export function guessUnit(header) {
  const m = header.match(/[([]\s*([^)\]]{1,12})\s*[)\]]\s*$/) || header.match(/\s(%|°C|V|A|W|kW|kWh|Wh|Hz|bar|m³\/h)\s*$/);
  return m ? m[1].trim() : '';
}
const cleanTitle = header => header.replace(/\s*[([][^)\]]*[)\]]\s*$/, '').trim() || header;

/** Energía estimada (kWh) integrando una serie de potencia; ignora huecos de más de 2 horas. */
export function integrateEnergyKwh(points, unit) {
  const factor = /^kw$/i.test(unit) ? 1 : /^w$/i.test(unit) ? 0.001 : 0;
  if (!factor) return null;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t;
    if (dt <= 0 || dt > 7200000) continue;
    total += ((points[i].v + points[i - 1].v) / 2) * factor * (dt / 3600000);
  }
  return total;
}

/**
 * Construye gráficos a partir del CSV. `options`: {timeCol, dateCol (opcional), valueCols:[índice o {col,title,unit}], tz, maxPoints, from, to}.
 * Las filas sin tiempo o sin número se omiten y se informa cuántas.
 */
export function buildChartsFromCsv({headers, rows}, options) {
  const tz = options.tz || 'UTC';
  if (!validTimeZone(tz)) throw new Error('Zona horaria inválida.');
  if (!Number.isInteger(options.timeCol) || options.timeCol < 0 || options.timeCol >= headers.length) throw new Error('Elige la columna de fecha y hora.');
  if (!options.valueCols?.length) throw new Error('Elige al menos una columna de valores.');
  const dateCol = Number.isInteger(options.dateCol) && options.dateCol >= 0 && options.dateCol < headers.length ? options.dateCol : -1;
  const times = rows.map(r => parseTimestamp(dateCol >= 0 ? `${r[dateCol]} ${r[options.timeCol]}` : r[options.timeCol], tz));
  const charts = [], skipped = {};
  for (const item of options.valueCols) {
    const spec = typeof item === 'number' ? {col: item} : item;
    if (!Number.isInteger(spec.col) || spec.col < 0 || spec.col >= headers.length) throw new Error('Columna de valores inválida.');
    const unit = spec.unit ?? guessUnit(headers[spec.col]);
    let raw = [], omitted = 0;
    rows.forEach((r, i) => {
      const v = parseNumber(r[spec.col]);
      if (times[i] === null || v === null) { omitted++; return; }
      if ((options.from && times[i] < options.from) || (options.to && times[i] > options.to)) return;
      raw.push({t: times[i], v});
    });
    raw.sort((a, b) => a.t - b.t);
    if (raw.length < 2) throw new Error(`La columna «${headers[spec.col]}» no tiene al menos dos lecturas válidas.`);
    const energy = integrateEnergyKwh(raw, unit);
    const points = downsample(raw, Math.min(options.maxPoints || 240, chartLimits.maxPoints));
    skipped[headers[spec.col]] = omitted;
    const note = [`${raw.length} lecturas${points.length < raw.length ? ` reducidas a ${points.length} para el documento` : ''}`, energy !== null ? `energía estimada por integración: ${new Intl.NumberFormat('es-CL', {maximumFractionDigits: 2}).format(energy)} kWh` : ''].filter(Boolean).join(' · ');
    charts.push({id: 'e' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36), title: (spec.title || cleanTitle(headers[spec.col])).slice(0, 200), unit, source: 'energy', note, tz, points});
  }
  return {charts: normalizeCharts(charts), omitted: skipped};
}
