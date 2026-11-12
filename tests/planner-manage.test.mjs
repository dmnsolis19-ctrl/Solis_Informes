import test from 'node:test';
import assert from 'node:assert/strict';
import {newOperation, normalizeOperation} from '../public/js/operations.js';
import {rescheduleVisit, cancelVisit, dateRangeForReschedule, sameOwnerLoad, newVisit, ensureOccurrences, regeneratePlan, closeVisit, shouldWriteCancel, shouldWriteCreate, visitsToClose, urgencyBuckets, monthGrid, complianceStats} from '../public/js/planner.js';
import {fmtDate} from '../public/js/domain.js';

const TODAY = '2026-11-12';
const eq = new Set(['e1']);
const plan = (o = {}) => ({...newOperation('workOrders', 'c1'), id: 'p1', name: 'Plan', type: 'Plan de mantenimiento', planState: 'Activo', anchorDate: '2026-10-01', intervalDays: '30', equipmentId: 'e1', ...o});
const visit = (o = {}) => ({...newVisit(plan(), '2026-11-30'), ...o});
const frozen = o => Object.freeze({...o});

test('dateRangeForReschedule: [hoy − 365, hoy + 730] con aritmética UTC entera, también cruzando año bisiesto y fin de año', () => {
  assert.deepEqual(dateRangeForReschedule(TODAY), {min: '2025-11-12', max: '2028-11-11'});
  assert.deepEqual(dateRangeForReschedule('2026-12-03'), {min: '2025-12-03', max: '2028-12-02'});
  assert.deepEqual(dateRangeForReschedule('2027-01-02'), {min: '2026-01-02', max: '2029-01-01'});
  assert.deepEqual(dateRangeForReschedule('2026-03-29'), {min: '2025-03-29', max: '2028-03-28'});
});

test('rescheduleVisit: cambia la fecha, marca manualEdit, conserva el id y no muta la visita', () => {
  const v = frozen(visit()), next = rescheduleVisit(v, '2026-12-05', TODAY);
  assert.equal(next.dueDate, '2026-12-05'); assert.equal(next.manualEdit, '1');
  assert.equal(next.id, v.id, 'el id determinista no se recalcula');
  assert.equal(next.status, 'Planificada'); assert.equal(next.name, v.name);
  assert.equal(v.dueDate, '2026-11-30'); assert.equal(v.manualEdit, '');
  assert.notEqual(next, v);
});

test('rescheduleVisit: misma fecha o visita que no está Planificada devuelve null', () => {
  assert.equal(rescheduleVisit(visit(), '2026-11-30', TODAY), null);
  for (const status of ['Completada', 'En curso', 'Cancelada']) assert.equal(rescheduleVisit(visit({status}), '2026-12-05', TODAY), null, status);
});

test('rescheduleVisit: una fecha vacía o inválida lanza el mensaje en español', () => {
  for (const bad of ['', undefined, null, '2026-02-30', '2026-13-01', '05/12/2026', 'mañana', '2026-1-5', 20261205])
    assert.throws(() => rescheduleVisit(visit(), bad, TODAY), {message: 'Elige una fecha válida.'}, String(bad));
});

test('rescheduleVisit: los bordes exactos del rango se aceptan y un día más allá lanza con las dos fechas formateadas', () => {
  const lo = '2025-11-12', hi = '2028-11-11';
  assert.equal(rescheduleVisit(visit(), lo, TODAY).dueDate, lo);
  assert.equal(rescheduleVisit(visit(), hi, TODAY).dueDate, hi);
  const msg = `Elige una fecha entre ${fmtDate(lo)} y ${fmtDate(hi)}.`;
  assert.throws(() => rescheduleVisit(visit(), '2025-11-11', TODAY), {message: msg});
  assert.throws(() => rescheduleVisit(visit(), '2028-11-12', TODAY), {message: msg});
});

test('rescheduleVisit: la validación va antes que «sin cambios» solo para fechas mal escritas; la misma fecha fuera de rango es null', () => {
  assert.equal(rescheduleVisit(visit({dueDate: '2020-01-01'}), '2020-01-01', TODAY), null);
  assert.throws(() => rescheduleVisit(visit({dueDate: '2020-01-01'}), '2020-01-02', TODAY), /Elige una fecha entre/);
});

test('cancelVisit: estado, closedReason, manualEdit y nota con el motivo; no muta', () => {
  const v = frozen(visit()), next = cancelVisit(v, 'Equipo fuera de servicio', TODAY);
  assert.equal(next.status, 'Cancelada'); assert.equal(next.closedReason, 'visita cancelada'); assert.equal(next.manualEdit, '1');
  assert.equal(next.notes, 'Visita cancelada el 2026-11-12: Equipo fuera de servicio');
  assert.equal(next.id, v.id); assert.equal(next.dueDate, v.dueDate);
  assert.equal(v.status, 'Planificada'); assert.equal(v.notes, '');
});

test('cancelVisit: sin motivo (vacío o solo espacios) la línea termina en punto', () => {
  assert.equal(cancelVisit(visit(), '', TODAY).notes, 'Visita cancelada el 2026-11-12.');
  assert.equal(cancelVisit(visit(), '   ', TODAY).notes, 'Visita cancelada el 2026-11-12.');
  assert.equal(cancelVisit(visit(), undefined, TODAY).notes, 'Visita cancelada el 2026-11-12.');
  assert.equal(cancelVisit(visit(), '  Sin repuesto  ', TODAY).notes, 'Visita cancelada el 2026-11-12: Sin repuesto');
});

test('cancelVisit: añade la línea después de las notas anteriores sin pisarlas', () => {
  const next = cancelVisit(visit({notes: 'Llamar antes de ir.'}), 'Cliente sin acceso', TODAY);
  assert.equal(next.notes, 'Llamar antes de ir.\nVisita cancelada el 2026-11-12: Cliente sin acceso');
});

test('cancelVisit: respeta el límite de 20000 de notes recortando el motivo, no las notas anteriores', () => {
  const old = 'n'.repeat(19950), next = cancelVisit(visit({notes: old}), 'r'.repeat(200), TODAY);
  assert.ok(next.notes.startsWith(old + '\n'));
  assert.equal(next.notes.length, 20000);
  assert.ok(next.notes.endsWith('r'));
  assert.doesNotThrow(() => normalizeOperation('workOrders', next));
  // si ni la línea sin motivo cabe, las notas quedan intactas y la visita igualmente se cancela
  const full = 'n'.repeat(19990), tight = cancelVisit(visit({notes: full}), 'motivo', TODAY);
  assert.equal(tight.notes, full); assert.equal(tight.status, 'Cancelada');
  assert.doesNotThrow(() => normalizeOperation('workOrders', tight));
});

test('cancelVisit: null si la visita no está Planificada', () => {
  for (const status of ['Completada', 'En curso', 'Cancelada']) assert.equal(cancelVisit(visit({status}), 'x', TODAY), null, status);
});

test('cancelVisit: el motivo se normaliza a una sola línea', () => {
  assert.equal(cancelVisit(visit(), 'uno\ndos\r\n  tres', TODAY).notes, 'Visita cancelada el 2026-11-12: uno dos tres');
});

test('sameOwnerLoad: cuenta las visitas abiertas del mismo responsable ese día, sin contar la propia', () => {
  const me = visit({id: 'm', ownerId: 'u1', owner: 'Ana'});
  const list = [me, visit({id: 'a', dueDate: '2026-12-05', ownerId: 'u1'}), visit({id: 'b', dueDate: '2026-12-05', ownerId: 'u1', status: 'En curso'}),
    visit({id: 'c', dueDate: '2026-12-05', ownerId: 'u2'}), visit({id: 'd', dueDate: '2026-12-05', ownerId: 'u1', status: 'Cancelada'}),
    visit({id: 'e', dueDate: '2026-12-05', ownerId: 'u1', status: 'Completada'}), visit({id: 'f', dueDate: '2026-12-06', ownerId: 'u1'}),
    visit({id: 'g', dueDate: '2026-12-05', ownerId: 'u1', type: 'Plan de mantenimiento'}), visit({id: 'h', dueDate: '2026-12-05', ownerId: 'u1', _sync: {deleted: true}})];
  assert.equal(sameOwnerLoad(list, me, '2026-12-05'), 2);
  assert.equal(sameOwnerLoad(list, me, '2026-12-06'), 1);
  assert.equal(sameOwnerLoad(list, me, '2026-12-07'), 0);
  assert.equal(sameOwnerLoad(list, me, me.dueDate), 0, 'la propia visita no cuenta aunque siga en su fecha');
});

test('sameOwnerLoad: sin responsable devuelve 0; el responsable por texto se compara sin mayúsculas ni espacios sobrantes', () => {
  const none = visit({id: 'n'}), other = visit({id: 'o', dueDate: '2026-12-05'});
  assert.equal(sameOwnerLoad([none, other], none, '2026-12-05'), 0);
  const me = visit({id: 'm', owner: 'Beto Soto'});
  assert.equal(sameOwnerLoad([me, visit({id: 'x', dueDate: '2026-12-05', owner: ' beto soto '}), visit({id: 'y', dueDate: '2026-12-05', owner: 'Carla'})], me, '2026-12-05'), 1);
});

// --- Regeneración: las visitas reprogramadas o canceladas se conservan tal cual.
const p = plan({anchorDate: '2026-10-01', intervalDays: '30'}); // 2026-10-01, 10-31, 11-30, 12-30, 2027-01-29 ...
const base = () => ensureOccurrences(p, [], TODAY, eq);
const idsOf = list => list.map(x => x.id);

test('base del escenario: la ocurrencia del 30 de noviembre existe', () => {
  assert.ok(base().some(x => x.dueDate === '2026-11-30'));
});

test('ensureOccurrences no recrea la visita original después de reprogramarla ni de cancelarla', () => {
  const all = base(), target = all.find(x => x.dueDate === '2026-11-30');
  const moved = rescheduleVisit(target, '2026-12-08', TODAY), gone = cancelVisit(target, 'x', TODAY);
  for (const changed of [moved, gone]) {
    const rows = all.map(x => x.id === target.id ? changed : x);
    assert.deepEqual(ensureOccurrences(p, rows, TODAY, eq), [], 'sin duplicados ni revivir');
    assert.equal(ensureOccurrences(p, rows, TODAY, eq).some(x => x.dueDate === '2026-11-30'), false);
  }
});

test('ensureOccurrences no revive una visita cancelada a mano, pero sí una cancelada por «calendario corrido»', () => {
  const all = base(), target = all.find(x => x.dueDate === '2026-11-30');
  const mine = {...cancelVisit(target, '', TODAY)}, shifted = {...target, status: 'Cancelada', closedReason: 'calendario corrido'};
  assert.deepEqual(ensureOccurrences(p, all.map(x => x.id === target.id ? mine : x), TODAY, eq), []);
  assert.deepEqual(idsOf(ensureOccurrences(p, all.map(x => x.id === target.id ? shifted : x), TODAY, eq)), [target.id]);
});

test('regeneratePlan no cancela la visita reprogramada ni crea otra, y no revive la cancelada', () => {
  const all = base(), target = all.find(x => x.dueDate === '2026-11-30');
  const moved = rescheduleVisit(target, '2026-12-08', TODAY), gone = cancelVisit(target, 'x', TODAY);
  for (const changed of [moved, gone]) {
    const rows = all.map(x => x.id === target.id ? changed : x), r = regeneratePlan(p, rows, TODAY, eq);
    assert.deepEqual(r.cancel, [], 'ninguna se cancela');
    assert.equal(r.create.some(x => x.id === target.id || x.dueDate === '2026-11-30'), false);
    assert.deepEqual(r.create, []);
  }
  // con la ancla corrida el plan se recalcula, pero la visita protegida se queda donde está
  const shifted = {...p, anchorDate: '2026-11-20'}, rows = all.map(x => x.id === target.id ? rescheduleVisit(target, '2026-12-08', TODAY) : x), r = regeneratePlan(shifted, rows, TODAY, eq);
  assert.equal(r.cancel.some(x => x.id === target.id), false);
  assert.equal(r.cancel.length > 0, true, 'las demás sin edición manual sí siguen al plan');
  assert.equal(r.create.some(x => x.id === target.id), false);
});

test('closeVisit en modo «shift» no cancela ni duplica las visitas reprogramadas o canceladas', () => {
  const all = base(), a = all.find(x => x.dueDate === '2026-11-30'), b = all.find(x => x.dueDate === '2026-12-30'), c = all.find(x => x.dueDate === '2027-01-29');
  const open = {...visit({id: 'done', dueDate: '2026-11-10', status: 'En curso', reportId: 'r1'})};
  const rows = [open, ...all.map(x => x.id === a.id ? rescheduleVisit(a, '2026-12-08', TODAY) : x.id === b.id ? cancelVisit(b, 'x', TODAY) : x)];
  const r = closeVisit(p, rows, open, TODAY, 'shift', TODAY, 'Ana', eq);
  assert.equal(r.cancel.some(x => x.id === a.id || x.id === b.id), false);
  assert.equal(r.cancel.some(x => x.id === c.id), true, 'la visita sin protección sí se recorre');
  assert.equal(r.create.some(x => x.id === a.id || x.id === b.id), false);
  assert.equal(new Set(idsOf(r.create)).size, r.create.length, 'sin duplicados');
  // modo «keep»: tampoco crea nada sobre las protegidas
  const k = closeVisit(p, rows, open, TODAY, 'keep', TODAY, 'Ana', eq);
  assert.deepEqual(k.cancel, []);
  assert.equal(k.create.some(x => x.id === a.id || x.id === b.id), false);
});

test('shouldWriteCancel y shouldWriteCreate no tocan una visita cancelada a mano ni una reprogramada', () => {
  const target = visit(), gone = cancelVisit(target, 'x', TODAY), moved = rescheduleVisit(target, '2026-12-08', TODAY);
  assert.equal(shouldWriteCancel(gone), 'skip');
  assert.equal(shouldWriteCancel(moved), 'skip');
  assert.equal(shouldWriteCreate(gone, {...target, status: 'Planificada'}), 'skip');
  assert.equal(shouldWriteCreate(gone, {...target, status: 'Cancelada', closedReason: 'calendario corrido'}), 'skip');
  assert.equal(shouldWriteCreate({...gone, closedReason: 'calendario corrido'}, {...target, status: 'Planificada'}), 'write', 'la cancelada por calendario corrido sí se revive');
});

test('visitas reprogramadas y canceladas siguen las reglas de las vistas del Planner y de los indicadores', () => {
  const target = visit({id: 't1', dueDate: '2026-11-10'}), gone = cancelVisit(target, '', TODAY), moved = rescheduleVisit(target, '2026-12-08', TODAY);
  assert.equal(urgencyBuckets([gone], TODAY).overdue.length, 0);
  assert.equal(urgencyBuckets([moved], TODAY).overdue.length, 0, 'la reprogramada deja de estar vencida');
  assert.equal(urgencyBuckets([moved], TODAY).next30.length, 1);
  const cell = monthGrid([gone], 2026, 11, TODAY).weeks.flat().find(d => d.date === '2026-11-10');
  assert.equal(cell.visits.length, 0);
  assert.equal(complianceStats([target], [], TODAY, 30).measured, 1);
  assert.equal(complianceStats([gone], [], TODAY, 30).measured, 0, 'la cancelada no es medible');
  assert.equal(complianceStats([moved], [], TODAY, 30).measured, 0, 'la reprogramada al futuro tampoco');
});

test('visitsToClose ignora las canceladas aunque tengan un informe emitido', () => {
  const gone = cancelVisit(visit({reportId: 'r1'}), '', TODAY);
  assert.deepEqual(visitsToClose([gone], [{id: 'r1', status: 'Emitido'}]), []);
});
