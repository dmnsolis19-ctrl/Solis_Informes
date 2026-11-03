// Gráficos de líneas en SVG para el documento. Sin dependencias: se ejecutan igual en el navegador y en el Worker.
// Cada gráfico guarda sus puntos dentro del informe; así el documento emitido no cambia aunque cambien otros informes.
import {escapeHtml as e} from './domain.js';

export const chartLimits = {maxCharts: 12, maxPoints: 400, minTime: 946684800000, maxTime: 4102444800000};
export const chartSources = ['history', 'energy', 'manual'];
const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
const finite = n => typeof n === 'number' && Number.isFinite(n);

export function validTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 60) return false;
  try { new Intl.DateTimeFormat('es-CL', {timeZone: tz}); return true; } catch { return false; }
}

/** Reduce una serie a `max` puntos conservando su forma (Largest-Triangle-Three-Buckets). */
export function downsample(points, max = 240) {
  if (!Array.isArray(points) || points.length <= max || max < 3) return points.slice();
  const out = [points[0]], every = (points.length - 2) / (max - 2);
  let a = 0;
  for (let i = 0; i < max - 2; i++) {
    const start = Math.floor((i + 1) * every) + 1, end = Math.min(Math.floor((i + 2) * every) + 1, points.length);
    let avgT = 0, avgV = 0;
    for (let j = start; j < end; j++) { avgT += points[j].t; avgV += points[j].v; }
    const span = Math.max(1, end - start); avgT /= span; avgV /= span;
    const from = Math.floor(i * every) + 1, to = Math.floor((i + 1) * every) + 1;
    let best = -1, pick = from;
    for (let j = from; j < to; j++) {
      const area = Math.abs((points[a].t - avgT) * (points[j].v - points[a].v) - (points[a].t - points[j].t) * (avgV - points[a].v));
      if (area > best) { best = area; pick = j; }
    }
    out.push(points[pick]); a = pick;
  }
  out.push(points[points.length - 1]);
  return out;
}

export function chartSummary(points) {
  if (!points.length) return null;
  let min = Infinity, max = -Infinity, sum = 0;
  for (const p of points) { if (p.v < min) min = p.v; if (p.v > max) max = p.v; sum += p.v; }
  return {min, max, avg: sum / points.length, first: points[0].v, last: points.at(-1).v, count: points.length, from: points[0].t, to: points.at(-1).t};
}

/** Valida y limpia la lista de gráficos. Lanza Error con un mensaje para el usuario. */
export function normalizeCharts(list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > chartLimits.maxCharts) throw new Error(`Máximo ${chartLimits.maxCharts} gráficos por informe.`);
  const seen = new Set();
  return list.map(raw => {
    if (!raw || typeof raw !== 'object' || !idPattern.test(raw.id || '') || seen.has(raw.id)) throw new Error('Gráfico inválido o duplicado.');
    seen.add(raw.id);
    const text = (v, max) => { if (typeof v !== 'string' || v.length > max) throw new Error('Texto de gráfico demasiado extenso.'); return v; };
    const title = text(raw.title ?? '', 200).trim();
    if (!title) throw new Error('Cada gráfico necesita un título.');
    const source = raw.source ?? 'manual';
    if (!chartSources.includes(source)) throw new Error('Origen de gráfico inválido.');
    const tz = raw.tz ?? 'UTC';
    if (!validTimeZone(tz)) throw new Error('Zona horaria de gráfico inválida.');
    if (!Array.isArray(raw.points) || raw.points.length < 2 || raw.points.length > chartLimits.maxPoints) throw new Error(`Cada gráfico necesita entre 2 y ${chartLimits.maxPoints} puntos.`);
    const points = raw.points.map(p => {
      if (!p || !Number.isInteger(p.t) || p.t < chartLimits.minTime || p.t > chartLimits.maxTime || !finite(p.v) || Math.abs(p.v) > 1e15) throw new Error('Punto de gráfico inválido.');
      return {t: p.t, v: p.v};
    }).sort((x, y) => x.t - y.t);
    return {id: raw.id, title, unit: text(raw.unit ?? '', 30).trim(), source, note: text(raw.note ?? '', 500), tz, points};
  });
}

const number = (v, digits = 2) => new Intl.NumberFormat('es-CL', {maximumFractionDigits: digits}).format(v);

function niceStep(range, ticks) {
  const raw = range / Math.max(1, ticks), pow = 10 ** Math.floor(Math.log10(raw)), frac = raw / pow;
  return (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
}
function niceScale(min, max, ticks = 5) {
  if (min === max) { const pad = Math.abs(min) * 0.05 || 1; min -= pad; max += pad; }
  const step = niceStep(max - min, ticks), lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, values = [];
  for (let v = lo; v <= hi + step / 2; v += step) values.push(Number(v.toFixed(10)));
  return {lo, hi, values};
}
function dateParts(t, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('es-CL', {timeZone: tz, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(new Date(t)).map(p => [p.type, p.value]));
  return parts;
}
export function formatTime(t, tz, span) {
  const p = dateParts(t, tz), hour = p.hour === '24' ? '00' : p.hour;
  if (span <= 2 * 86400000) return `${p.day}/${p.month} ${hour}:${p.minute}`;
  if (span <= 400 * 86400000) return `${p.day}/${p.month}/${p.year}`;
  return `${p.month}/${p.year}`;
}
export const formatDateTime = (t, tz) => { const p = dateParts(t, tz); return `${p.day}/${p.month}/20${p.year} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`; };

/** SVG de un gráfico de líneas. Todo el texto pasa por escapeHtml. */
export function chartSvg(chart, {width = 720, height = 260} = {}) {
  const m = {l: 58, r: 16, t: 14, b: 34}, w = width - m.l - m.r, h = height - m.t - m.b, pts = chart.points;
  const values = pts.map(p => p.v), scale = niceScale(Math.min(...values), Math.max(...values));
  const t0 = pts[0].t, t1 = pts.at(-1).t, span = Math.max(1, t1 - t0);
  const x = t => m.l + ((t - t0) / span) * w, y = v => m.t + h - ((v - scale.lo) / (scale.hi - scale.lo)) * h;
  const r1 = n => Math.round(n * 10) / 10;
  const grid = scale.values.map(v => `<line x1="${m.l}" x2="${m.l + w}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="#d5dde2" stroke-width="1"/><text x="${m.l - 6}" y="${r1(y(v)) + 3.5}" text-anchor="end" font-size="10" fill="#41555f">${e(number(v))}</text>`).join('');
  const xs = Array.from({length: 5}, (_, i) => t0 + (span * i) / 4);
  const xLabels = xs.map((t, i) => `<line x1="${r1(x(t))}" x2="${r1(x(t))}" y1="${m.t + h}" y2="${m.t + h + 4}" stroke="#6b7c86"/><text x="${r1(x(t))}" y="${m.t + h + 17}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" font-size="10" fill="#41555f">${e(formatTime(t, chart.tz, span))}</text>`).join('');
  const line = pts.map(p => `${r1(x(p.t))},${r1(y(p.v))}`).join(' ');
  const marks = pts.length <= 40 ? pts.map(p => `<circle cx="${r1(x(p.t))}" cy="${r1(y(p.v))}" r="3" fill="var(--doc-primary,#123f54)"/>`).join('') : '';
  const unit = chart.unit ? `<text x="${m.l}" y="9" font-size="10" fill="#41555f">${e(chart.unit)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${e('Gráfico: ' + chart.title)}" font-family="Arial,Helvetica,sans-serif"><title>${e(chart.title)}</title><rect width="${width}" height="${height}" fill="#fff"/>${grid}<line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${m.t + h}" stroke="#6b7c86"/><line x1="${m.l}" x2="${m.l + w}" y1="${m.t + h}" y2="${m.t + h}" stroke="#6b7c86"/>${unit}${xLabels}<polyline points="${line}" fill="none" stroke="var(--doc-primary,#123f54)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>${marks}</svg>`;
}

export function chartFigure(chart, index) {
  const s = chartSummary(chart.points), unit = chart.unit ? ' ' + chart.unit : '';
  const origin = {history: 'Historial del equipo', energy: 'Datos importados', manual: 'Registro manual'}[chart.source];
  return `<figure class="doc-chart"><figcaption><b>Gráfico ${index + 1}. </b>${e(chart.title)}${chart.unit ? ` <span>(${e(chart.unit)})</span>` : ''}</figcaption>${chartSvg(chart)}<table class="doc-chart-stats"><thead><tr><th>Mínimo</th><th>Máximo</th><th>Promedio</th><th>Primero</th><th>Último</th><th>Muestras</th></tr></thead><tbody><tr><td>${e(number(s.min) + unit)}</td><td>${e(number(s.max) + unit)}</td><td>${e(number(s.avg) + unit)}</td><td>${e(number(s.first) + unit)}</td><td>${e(number(s.last) + unit)}</td><td>${s.count}</td></tr></tbody></table><p class="doc-note">${e(origin)} · ${e(formatDateTime(s.from, chart.tz))} a ${e(formatDateTime(s.to, chart.tz))} (${e(chart.tz)})${chart.note ? ' · ' + e(chart.note) : ''}</p></figure>`;
}
export const renderCharts = list => list?.length ? `<div class="doc-charts">${list.map(chartFigure).join('')}</div>` : '';
