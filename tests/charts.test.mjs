import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCharts, downsample, chartSummary, chartSvg, renderCharts, formatTime, validTimeZone, chartLimits} from '../public/js/charts.js';
import {newCompany, newReport} from '../public/js/domain.js';
import {validateReportData} from '../worker/validation.js';
import {renderDocument} from '../public/js/render.js';

const base = Date.UTC(2026, 9, 1, 12, 0, 0);
const series = n => Array.from({length: n}, (_, i) => ({t: base + i * 600000, v: Math.sin(i / 10) * 50 + 100}));
const chart = (extra = {}) => ({id: 'c1', title: 'Presión de salida', unit: 'bar', source: 'history', note: '', tz: 'America/Santiago', points: series(12), ...extra});

test('valida gráficos: límites, orden temporal y datos no finitos', () => {
  const [ok] = normalizeCharts([chart({points: [...series(5)].reverse()})]);
  assert.deepEqual(ok.points.map(p => p.t), [...ok.points.map(p => p.t)].sort((a, b) => a - b));
  assert.throws(() => normalizeCharts([chart({points: [{t: base, v: 1}]})]), /entre 2 y/);
  assert.throws(() => normalizeCharts([chart({points: [{t: base, v: 1}, {t: base + 1, v: NaN}]})]), /Punto/);
  assert.throws(() => normalizeCharts([chart({points: [{t: base, v: 1}, {t: 12, v: 2}]})]), /Punto/);
  assert.throws(() => normalizeCharts([chart({title: '  '})]), /título/);
  assert.throws(() => normalizeCharts([chart({id: 'a b'})]), /inválido/);
  assert.throws(() => normalizeCharts([chart({tz: 'Mars/Olympus'})]), /Zona/);
  assert.throws(() => normalizeCharts([chart({source: 'otro'})]), /Origen/);
  assert.throws(() => normalizeCharts([chart(), chart()]), /duplicado/);
  assert.throws(() => normalizeCharts(Array.from({length: chartLimits.maxCharts + 1}, (_, i) => chart({id: 'x' + i}))), /Máximo/);
  assert.deepEqual(normalizeCharts(undefined), []);
});

test('el submuestreo conserva extremos, cantidad y forma general', () => {
  const big = series(2000), small = downsample(big, 200);
  assert.equal(small.length, 200);
  assert.equal(small[0], big[0]);
  assert.equal(small.at(-1), big.at(-1));
  assert.ok(small.every((p, i) => i === 0 || p.t > small[i - 1].t));
  const peak = Math.max(...big.map(p => p.v)), kept = Math.max(...small.map(p => p.v));
  assert.ok(peak - kept < 2, 'conserva los picos');
  assert.equal(downsample(series(10), 200).length, 10);
});

test('resumen estadístico', () => {
  const s = chartSummary([{t: 1, v: 2}, {t: 2, v: 4}, {t: 3, v: 9}]);
  assert.deepEqual([s.min, s.max, s.avg, s.first, s.last, s.count], [2, 9, 5, 2, 9, 3]);
});

test('el SVG escapa texto, usa la zona horaria y sirve para series constantes', () => {
  const svg = chartSvg({...chart({title: '<img src=x onerror=alert(1)>', unit: '"&'}), points: normalizeCharts([chart()])[0].points});
  assert.ok(!svg.includes('<img'));
  assert.ok(svg.includes('&lt;img'));
  assert.ok(svg.startsWith('<svg') && svg.includes('<polyline'));
  const flat = chartSvg(normalizeCharts([chart({points: [{t: base, v: 5}, {t: base + 1000, v: 5}]})])[0]);
  assert.ok(!flat.includes('NaN') && !flat.includes('Infinity'));
  // 12:00 UTC del 1 de octubre de 2026 es 09:00 en Santiago (UTC-3 todavía no; el horario de verano empieza en septiembre).
  assert.match(formatTime(base, 'America/Santiago', 3600000), /^01\/10 0[89]:00$/);
  assert.equal(formatTime(base, 'UTC', 3600000), '01/10 12:00');
  assert.ok(validTimeZone('America/Santiago') && !validTimeZone('x'));
});

test('el documento incluye los gráficos aunque no haya lecturas y la validación del servidor los conserva', () => {
  const company = {...newCompany(), name: 'Empresa de gráficos'}, r = newReport('waterPlant', company, 'GR-1');
  r.charts = [chart()];
  assert.ok(r.measurements.every(m => m.value === ''));
  const html = renderDocument(r, '');
  assert.ok(html.includes('doc-chart') && html.includes('Presión de salida') && html.includes('Mediciones y pruebas'));
  const stored = validateReportData(r);
  assert.equal(stored.charts.length, 1);
  assert.equal(renderCharts([]), '');
  r.charts = [chart({points: [{t: base, v: 1}]})];
  assert.throws(() => validateReportData(r), error => error.status === 400);
});
