import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv, parseNumber, parseTimestamp, zonedToEpoch, detectColumns, guessUnit, integrateEnergyKwh, buildChartsFromCsv} from '../public/js/energy-import.js';
import {newCompany, newReport} from '../public/js/domain.js';
import {validateReportData} from '../worker/validation.js';
import {renderDocument} from '../public/js/render.js';

test('números con coma o punto decimal y sufijos de unidad', () => {
  assert.equal(parseNumber('12,5'), 12.5);
  assert.equal(parseNumber('1.234,56'), 1234.56);
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber('3.2 kW'), 3.2);
  assert.equal(parseNumber('-0,4'), -0.4);
  assert.equal(parseNumber('1.234.567'), 1234567);
  assert.equal(parseNumber('abc'), null);
  assert.equal(parseNumber(''), null);
});

test('marcas de tiempo: ISO con zona, texto local, formato chileno y época', () => {
  assert.equal(parseTimestamp('2026-10-01T12:00:00Z'), Date.UTC(2026, 9, 1, 12));
  assert.equal(parseTimestamp('2026-10-01 12:00:00+02:00'), Date.UTC(2026, 9, 1, 10));
  // Santiago en octubre usa UTC-3 (horario de verano).
  assert.equal(parseTimestamp('2026-10-01 12:00', 'America/Santiago'), Date.UTC(2026, 9, 1, 15));
  assert.equal(parseTimestamp('01-10-2026 12:00', 'America/Santiago'), Date.UTC(2026, 9, 1, 15));
  assert.equal(parseTimestamp('01/10/2026', 'UTC'), Date.UTC(2026, 9, 1));
  assert.equal(parseTimestamp('1790856000'), 1790856000000);
  assert.equal(parseTimestamp('mañana'), null);
  assert.equal(parseTimestamp('32/13/2026'), null);
  // En invierno (abril–septiembre) Santiago usa UTC-4.
  assert.equal(zonedToEpoch(2026, 7, 1, 12, 0, 0, 'America/Santiago'), Date.UTC(2026, 6, 1, 16));
});

const csv = [
  'Timestamp;SOC (%);Potencia FV (kW);Potencia red [W];Estado',
  '2026-10-01 08:00:00;55,0;0,0;1200;OK',
  '2026-10-01 09:00:00;58,5;2,0;900;OK',
  '2026-10-01 10:00:00;64,0;4,0;300;OK',
  '2026-10-01 11:00:00;70,5;4,0;-200;OK',
  'sin fecha;71;1;1;OK'
].join('\n');

test('lee el CSV, detecta columnas y construye gráficos con energía integrada', () => {
  const data = parseCsv(csv);
  assert.equal(data.delimiter, ';');
  assert.equal(data.headers.length, 5);
  const cols = detectColumns(data.headers, data.rows, 'America/Santiago');
  assert.equal(cols.timeCol, 0);
  assert.deepEqual(cols.valueCols, [1, 2, 3]);
  assert.equal(guessUnit('SOC (%)'), '%');
  assert.equal(guessUnit('Potencia red [W]'), 'W');
  const {charts, omitted} = buildChartsFromCsv(data, {timeCol: 0, valueCols: cols.valueCols, tz: 'America/Santiago'});
  assert.equal(charts.length, 3);
  assert.equal(omitted['SOC (%)'], 1, 'la fila sin fecha se omite');
  const soc = charts[0], pv = charts[1];
  assert.equal(soc.title, 'SOC');
  assert.equal(soc.unit, '%');
  assert.equal(soc.points.length, 4);
  assert.equal(soc.points[0].t, Date.UTC(2026, 9, 1, 11));
  // 0→2→4→4 kW cada hora: (1+3+4) = 8 kWh.
  assert.equal(integrateEnergyKwh(pv.points, 'kW'), 8);
  assert.match(pv.note, /energía estimada por integración: 8 kWh/);
  assert.equal(integrateEnergyKwh(pv.points, '%'), null);
});

test('fecha y hora en columnas separadas, valores no numéricos y errores claros', () => {
  const data = parseCsv('Fecha,Hora,Nivel\n01/10/2026,08:00,1.5\n01/10/2026,09:00,1.7\n01/10/2026,10:00,x');
  const cols = detectColumns(data.headers, data.rows, 'UTC');
  assert.deepEqual([cols.dateCol, cols.timeCol], [0, 1]);
  const {charts} = buildChartsFromCsv(data, {...cols, valueCols: [2], tz: 'UTC'});
  assert.equal(charts[0].points.length, 2);
  assert.throws(() => parseCsv('a,b\n1,2'), /al menos dos filas/);
  assert.throws(() => buildChartsFromCsv(data, {timeCol: 0, valueCols: [], tz: 'UTC'}), /al menos una columna/);
  assert.throws(() => buildChartsFromCsv(parseCsv('t,v\n2026-01-01,x\n2026-01-02,y\n2026-01-03,z'), {timeCol: 0, valueCols: [1]}), /dos lecturas válidas/);
  assert.throws(() => buildChartsFromCsv(data, {timeCol: 0, valueCols: [2], tz: 'Mars/Olympus'}), /Zona horaria/);
  const quoted = parseCsv('t,"nombre, con coma",v\n2026-01-01,"a ""b""",1\n2026-01-02,c,2');
  assert.equal(quoted.headers[1], 'nombre, con coma');
  assert.equal(quoted.rows[0][1], 'a "b"');
});

test('series largas se reducen y el informe con datos importados es válido para el servidor', () => {
  const lines = ['time,power (kW)'];
  for (let i = 0; i < 3000; i++) lines.push(`${new Date(Date.UTC(2026, 9, 1) + i * 60000).toISOString()},${(Math.sin(i / 50) * 3 + 3).toFixed(2)}`);
  const data = parseCsv(lines.join('\n'));
  const {charts} = buildChartsFromCsv(data, {timeCol: 0, valueCols: [1], tz: 'UTC'});
  assert.equal(charts[0].points.length, 240);
  assert.match(charts[0].note, /3000 lecturas reducidas a 240/);
  const r = newReport('bess', {...newCompany(), name: 'Empresa de energía'}, 'EN-1');
  r.charts = charts;
  assert.equal(validateReportData(r).charts[0].source, 'energy');
  assert.ok(renderDocument(r, '').includes('energía estimada por integración'));
});
