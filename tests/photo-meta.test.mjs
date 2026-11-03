import test from 'node:test';
import assert from 'node:assert/strict';
import {validTakenAt, validGeo, formatGeo, captureTime, readPhotoMeta, photoMetaLine, appendDictation, defaultPhotoMeta, dictationSupported} from '../public/js/photo-meta.js';
import {newCompany, newReport, normalizeReport} from '../public/js/domain.js';
import {validateReportData} from '../worker/validation.js';
import {renderDocument} from '../public/js/render.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTZkAAAAASUVORK5CYII=';

test('formato y validación de hora y ubicación', () => {
  assert.equal(formatGeo(-22.90871, -68.2, 12.4), '-22.90871,-68.20000 ±12 m');
  assert.equal(formatGeo(-22.9, -68.2, undefined), '-22.90000,-68.20000');
  assert.equal(formatGeo(95, 0, 1), '');
  assert.equal(formatGeo(NaN, 0, 1), '');
  assert.ok(validGeo('') && validGeo('-22.90871,-68.20000 ±12 m') && validGeo('10,20'));
  assert.ok(!validGeo('<script>') && !validGeo('1,2,3') && !validGeo('x'.repeat(50)));
  assert.ok(validTakenAt('') && validTakenAt('2026-10-01T15:30:00.000Z'));
  assert.ok(!validTakenAt('ayer') && !validTakenAt(5) && !validTakenAt('2026-10-01T15:30:00Z' + 'x'.repeat(50)));
});

test('la hora de captura usa la del archivo si es reciente y el momento actual si no', async () => {
  const now = Date.UTC(2026, 10, 2, 15, 0, 0);
  assert.equal(captureTime({lastModified: now - 3600000}, now), new Date(now - 3600000).toISOString());
  assert.equal(captureTime({lastModified: now - 3 * 86400000}, now), new Date(now).toISOString(), 'archivo antiguo: ahora');
  assert.equal(captureTime({lastModified: now + 10 * 60000}, now), new Date(now).toISOString(), 'fecha del futuro: ahora');
  assert.equal(captureTime({}, now), new Date(now).toISOString());
  assert.deepEqual(await readPhotoMeta({lastModified: now - 1000}, {time: false, geo: false}, now), {takenAt: '', geo: ''});
  assert.equal((await readPhotoMeta({lastModified: now - 1000}, defaultPhotoMeta, now)).geo, '', 'la ubicación no se pide por defecto');
  assert.equal(dictationSupported(), false);
});

test('el servidor conserva y valida los datos de la fotografía', () => {
  const r = newReport('general', {...newCompany(), name: 'Empresa'}, 'PH-1');
  r.photos = [{id: 'f1', dataUrl: png, caption: 'Bomba', tag: '', takenAt: '2026-10-01T15:30:00.000Z', geo: '-22.90871,-68.20000 ±12 m'}];
  const stored = validateReportData(r);
  assert.equal(stored.photos[0].takenAt, '2026-10-01T15:30:00.000Z');
  assert.equal(stored.photos[0].geo, '-22.90871,-68.20000 ±12 m');
  assert.equal(normalizeReport(stored, null).photos[0].geo, stored.photos[0].geo);
  r.photos[0].geo = '<img src=x>';
  assert.throws(() => validateReportData(r), e => e.status === 400);
  r.photos[0].geo = ''; r.photos[0].takenAt = 'nunca';
  assert.throws(() => validateReportData(r), e => e.status === 400);
  const old = newReport('general', {...newCompany(), name: 'Empresa'}, 'PH-2'); old.photos = [{id: 'f2', dataUrl: png, caption: '', tag: ''}];
  assert.equal(validateReportData(old).photos[0].takenAt, '', 'las fotos antiguas siguen siendo válidas');
});

test('el documento muestra la hora y la ubicación en el pie de la fotografía', () => {
  const r = newReport('general', {...newCompany(), name: 'Empresa'}, 'PH-3');
  r.photos = [{id: 'f1', dataUrl: png, caption: 'Tablero', tag: '', takenAt: '2026-10-01T15:30:00.000Z', geo: '-22.90871,-68.20000 ±12 m'}, {id: 'f2', dataUrl: png, caption: 'Sin datos', tag: '', takenAt: '', geo: ''}];
  const html = renderDocument(r, '');
  assert.match(html, /Registrada el 01\/10\/2026 12:30 · Ubicación: -22\.90871,-68\.20000 ±12 m/);
  assert.equal((html.match(/Registrada el/g) || []).length, 1);
  assert.equal(photoMetaLine({takenAt: '', geo: ''}), '');
});

test('dictado: une frases con espacios y mayúsculas correctas', () => {
  assert.equal(appendDictation('', 'se revisó el filtro'), 'Se revisó el filtro');
  assert.equal(appendDictation('Se revisó el filtro.', 'la presión es normal'), 'Se revisó el filtro. La presión es normal');
  assert.equal(appendDictation('Se revisó el filtro', ' y la bomba '), 'Se revisó el filtro y la bomba');
  assert.equal(appendDictation('Línea uno\n', 'línea dos'), 'Línea uno\nlínea dos');
  assert.equal(appendDictation('Texto', '   '), 'Texto');
  assert.equal(appendDictation('Texto', undefined), 'Texto');
});
