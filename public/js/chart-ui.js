// Interfaz del editor para gráficos: tendencias del historial del equipo e importación de datos CSV.
import {escapeHtml as e, uid} from './domain.js';
import {measurementSeries, latestReports} from './operations.js';
import {parseCsv, detectColumns, buildChartsFromCsv, guessUnit, importLimits} from './energy-import.js';
import {chartLimits} from './charts.js';

const localZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };
let pendingCsv = null;

const originLabel = {history: 'Historial del equipo', energy: 'Datos importados', manual: 'Registro manual'};

export function chartsPanel(r) {
  const editable = r.status === 'Borrador', charts = r.charts || [];
  const buttons = editable ? `<div class="button-row"><button class="btn secondary small" data-action="chart-history">Tendencia del equipo</button><button class="btn secondary small" data-action="chart-import">Importar datos (CSV)</button></div>` : '';
  const list = charts.map((c, i) => `<div class="repeat-card"><div class="repeat-heading"><b>Gráfico ${i + 1}</b>${editable ? `<button class="icon-btn remove" data-action="chart-remove" data-index="${i}" aria-label="Quitar gráfico">×</button>` : ''}</div><div class="form-grid"><label class="field wide"><span>Título</span><input data-field="charts.${i}.title" value="${e(c.title)}" maxlength="200" ${editable ? '' : 'disabled'}></label><label class="field wide"><span>Nota (opcional)</span><input data-field="charts.${i}.note" value="${e(c.note || '')}" maxlength="500" ${editable ? '' : 'disabled'}></label></div><p class="muted">${e(originLabel[c.source] || '')} · ${c.points.length} puntos${c.unit ? ' · ' + e(c.unit) : ''}</p></div>`).join('');
  return `<div class="subheading"><h3>Gráficos y tendencias</h3>${buttons}</div><p class="muted">Los gráficos se guardan con el informe y aparecen en «Mediciones y pruebas» del documento. Importa un CSV de tu registrador o compara lecturas del mismo equipo en visitas anteriores.</p>${list || '<p class="muted">Aún no hay gráficos en este informe.</p>'}`;
}

function currentReadings(report) {
  return (report.measurements || []).filter(m => String(m.value).trim() !== '' && Number.isFinite(Number(String(m.value).replace(',', '.'))));
}

/** Parámetros del equipo con al menos dos lecturas, incluyendo las de este informe. */
export function historyCandidates(report, reports) {
  const id = report.equipmentRef;
  if (!id) return [];
  const pool = reports.filter(x => x.companyId === report.companyId && x.id !== report.id);
  const keys = new Map();
  for (const x of [...latestReports(pool), report]) for (const m of currentReadings(x)) {
    if (x.equipmentRef !== id) continue;
    const key = `${m.label.trim().toLowerCase()}|${(m.unit || '').trim().toLowerCase()}`;
    if (!keys.has(key)) keys.set(key, {label: m.label.trim(), unit: (m.unit || '').trim()});
  }
  const out = [];
  for (const {label, unit} of keys.values()) {
    const series = measurementSeries(pool, id, label, unit);
    if (!series.some(s => s.reportId === report.id)) {
      const n = currentReadings(report).find(m => m.label.trim().toLowerCase() === label.toLowerCase() && (m.unit || '').trim().toLowerCase() === unit.toLowerCase());
      if (n && report.serviceDate) series.push({date: report.serviceDate, value: Number(String(n.value).replace(',', '.')), unit, folio: report.folio, reportId: report.id});
    }
    series.sort((a, b) => a.date.localeCompare(b.date));
    if (series.length >= 2) out.push({label, unit, series});
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

function historyChart(candidate, report, tz) {
  const points = candidate.series.map(s => ({t: new Date(s.date + 'T12:00:00').getTime(), v: s.value})).filter(p => Number.isFinite(p.t));
  const equipment = report.equipment?.assetTag || report.equipment?.equipmentType || '';
  return {id: 'h' + uid().replaceAll('-', '').slice(0, 12), title: `${candidate.label}${equipment ? ' · ' + equipment : ''}`, unit: candidate.unit, source: 'history', note: 'Folios: ' + [...new Set(candidate.series.map(s => s.folio))].join(', '), tz, points};
}

function csvConfig(data, tz) {
  const {timeCol, dateCol, valueCols} = detectColumns(data.headers, data.rows, tz);
  const options = data.headers.map((h, i) => `<option value="${i}" ${i === timeCol ? 'selected' : ''}>${e(h)}</option>`).join('');
  const dateOptions = `<option value="-1">(no usar)</option>` + data.headers.map((h, i) => `<option value="${i}" ${i === dateCol ? 'selected' : ''}>${e(h)}</option>`).join('');
  const values = data.headers.map((h, i) => `<div class="repeat-card"><label class="check"><input type="checkbox" data-csv-value="${i}" ${valueCols.includes(i) ? 'checked' : ''}> <b>${e(h)}</b></label><div class="form-grid"><label class="field"><span>Título</span><input data-csv-title="${i}" value="${e(h.replace(/\s*[([][^)\]]*[)\]]\s*$/, '').trim() || h)}" maxlength="200"></label><label class="field"><span>Unidad</span><input data-csv-unit="${i}" value="${e(guessUnit(h))}" maxlength="30"></label></div><small class="muted">Ej.: ${e(data.rows.slice(0, 3).map(r => r[i]).join(' · '))}</small></div>`).join('');
  return `<p class="muted">${data.rows.length} filas · separador «${e(data.delimiter === '\t' ? 'tabulación' : data.delimiter)}»</p><div class="form-grid"><label class="field"><span>Columna de fecha y hora</span><select id="csv-time">${options}</select></label><label class="field"><span>Columna de fecha (si la hora va aparte)</span><select id="csv-date">${dateOptions}</select></label><label class="field wide"><span>Zona horaria de los datos</span><input id="csv-tz" value="${e(tz)}" placeholder="America/Santiago"></label></div><h4>Columnas a graficar</h4>${values}<div class="modal-actions"><button class="btn primary" data-action="chart-import-add">Agregar gráficos</button></div>`;
}

export async function handleChartAction(button, ctx) {
  const a = button.dataset.action, {state} = ctx;
  if (!a?.startsWith('chart-')) return false;
  const report = state.report;
  if (!report || report.status !== 'Borrador') throw new Error('Solo puedes cambiar gráficos en borradores.');
  report.charts ||= [];
  const room = chartLimits.maxCharts - report.charts.length;

  if (a === 'chart-remove') { report.charts.splice(Number(button.dataset.index), 1); ctx.markDirty(); await ctx.persist(); ctx.render(); return true; }

  if (a === 'chart-history') {
    const candidates = historyCandidates(report, state.reports);
    if (!report.equipmentRef) { ctx.toast('Vincula el informe a un equipo del catálogo para comparar su historial.', true); return true; }
    if (!candidates.length) { ctx.toast('Este equipo aún no tiene un parámetro con al menos dos lecturas numéricas.', true); return true; }
    ctx.modal('Tendencia del equipo', `<p class="muted">Se grafican las lecturas del mismo parámetro y unidad en informes anteriores y en este.</p>${candidates.map((c, i) => `<label class="check"><input type="checkbox" data-history="${i}"> <b>${e(c.label)}</b>${c.unit ? ' (' + e(c.unit) + ')' : ''} · ${c.series.length} lecturas</label>`).join('')}<div class="modal-actions"><button class="btn primary" data-action="chart-history-add">Agregar gráficos</button></div>`);
    state.chartCandidates = candidates;
    return true;
  }
  if (a === 'chart-history-add') {
    const picked = [...document.querySelectorAll('#modal-root [data-history]:checked')].map(i => state.chartCandidates?.[Number(i.dataset.history)]).filter(Boolean);
    if (!picked.length) throw new Error('Selecciona al menos un parámetro.');
    if (picked.length > room) throw new Error(`Solo caben ${room} gráficos más en este informe.`);
    const tz = localZone();
    report.charts.push(...picked.map(c => historyChart(c, report, tz)));
    state.chartCandidates = null; ctx.closeModal(); ctx.markDirty(); await ctx.persist(); ctx.render(); ctx.toast('Gráficos agregados.'); return true;
  }

  if (a === 'chart-import') {
    if (room <= 0) { ctx.toast(`Este informe ya tiene ${chartLimits.maxCharts} gráficos.`, true); return true; }
    pendingCsv = null;
    ctx.modal('Importar datos (CSV)', `<p class="muted">Archivo CSV de tu registrador, de SOLIS Energy o de Node-RED, con una columna de fecha y hora y una o más columnas numéricas. Máximo 5 MB.</p><label class="upload-area"><b>Selecciona el archivo CSV</b><input id="csv-file" type="file" accept=".csv,.txt,text/csv,text/plain"></label><div id="csv-config"></div>`, {wide: true});
    const input = document.querySelector('#csv-file');
    input.addEventListener('change', async () => {
      const target = document.querySelector('#csv-config');
      try {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > importLimits.maxBytes) throw new Error('El archivo supera 5 MB. Exporta un periodo menor.');
        pendingCsv = parseCsv(await file.text());
        target.innerHTML = csvConfig(pendingCsv, localZone());
      } catch (error) { pendingCsv = null; target.innerHTML = `<div class="notice error">${e(error.message)}</div>`; }
    });
    return true;
  }
  if (a === 'chart-import-add') {
    if (!pendingCsv) throw new Error('Selecciona primero un archivo CSV.');
    const root = document.querySelector('#modal-root');
    const valueCols = [...root.querySelectorAll('[data-csv-value]:checked')].map(c => {
      const i = Number(c.dataset.csvValue);
      return {col: i, title: root.querySelector(`[data-csv-title="${i}"]`).value.trim(), unit: root.querySelector(`[data-csv-unit="${i}"]`).value.trim()};
    });
    const dateValue = Number(root.querySelector('#csv-date').value);
    const {charts, omitted} = buildChartsFromCsv(pendingCsv, {timeCol: Number(root.querySelector('#csv-time').value), dateCol: dateValue >= 0 ? dateValue : undefined, valueCols, tz: root.querySelector('#csv-tz').value.trim()});
    if (charts.length > room) throw new Error(`Solo caben ${room} gráficos más en este informe.`);
    report.charts.push(...charts);
    const skipped = Object.values(omitted).reduce((s, n) => s + n, 0);
    pendingCsv = null; ctx.closeModal(); ctx.markDirty(); await ctx.persist(); ctx.render();
    ctx.toast(`${charts.length} gráfico(s) agregado(s)${skipped ? ` · ${skipped} valores sin fecha o sin número se omitieron` : ''}.`);
    return true;
  }
  return false;
}
