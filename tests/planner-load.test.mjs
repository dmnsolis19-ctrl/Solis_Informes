import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workloadTable, workloadCell, reassignVisit, planReadonlyData, mondayOf} from '../public/js/planner.js';
import {canGenerateVisits} from '../public/js/planner-ui.js';

const TODAY = '2026-11-09'; // lunes
const v = (o = {}) => ({id: 'v' + Math.random(), name: 'Visita', type: 'Orden de trabajo', planId: 'p1', status: 'Planificada', priority: 'Media', dueDate: TODAY, ownerId: '', owner: '', customerId: '', equipmentId: '', ...o});
const people = [{id: 'u1', email: 'ana@e.test', role: 'technician'}, {id: 'u2', email: 'beto@e.test', role: 'supervisor'}];
const rowOf = (t, key) => t.rows.find(r => r.key === key);

test('workloadTable: 6 semanas que parten el lunes de la semana de hoy, con etiqueta «Sem. 9 nov»', () => {
  const t = workloadTable([], TODAY, people);
  assert.equal(t.weeks.length, 6);
  assert.deepEqual(t.weeks.map(w => w.monday), ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14']);
  assert.equal(t.weeks[0].label, 'Sem. 9 nov');
  assert.equal(t.weeks[3].label, 'Sem. 30 nov');
  assert.equal(t.weeks[4].label, 'Sem. 7 dic');
  assert.deepEqual(t.rows, []);
  assert.equal(t.max, 0);
});

test('workloadTable: si hoy es domingo la semana parte el lunes anterior; hoy a mitad de semana también', () => {
  assert.equal(mondayOf('2026-11-15'), '2026-11-09');
  assert.equal(mondayOf('2026-11-11'), '2026-11-09');
  assert.equal(mondayOf('2026-11-09'), '2026-11-09');
  assert.equal(mondayOf('2027-01-03'), '2026-12-28');
  assert.equal(workloadTable([], '2026-11-15', people).weeks[0].monday, '2026-11-09');
  assert.equal(workloadTable([], '2027-01-02', people).weeks[0].label, 'Sem. 28 dic');
});

test('workloadTable: el domingo cuenta en la semana que termina y el lunes en la siguiente', () => {
  const t = workloadTable([v({ownerId: 'u1', dueDate: '2026-11-15'}), v({ownerId: 'u1', dueDate: '2026-11-16'}), v({ownerId: 'u1', dueDate: '2026-11-22'})], TODAY, people);
  assert.deepEqual(rowOf(t, 'u1').cells, [1, 2, 0, 0, 0, 0]);
  assert.equal(rowOf(t, 'u1').total, 3);
});

test('workloadTable: límite de 6 semanas, vencidas y visitas lejanas', () => {
  const t = workloadTable([
    v({ownerId: 'u1', dueDate: '2026-12-20'}), // domingo de la sexta semana: cuenta
    v({ownerId: 'u1', dueDate: '2026-12-21'}), // lunes de la séptima: fuera
    v({ownerId: 'u1', dueDate: '2026-11-08'}), // ayer: vencida
    v({ownerId: 'u1', dueDate: '2026-10-01', status: 'En curso'}), // vencida en curso
    v({ownerId: 'u1', dueDate: TODAY}),
  ], TODAY, people);
  const r = rowOf(t, 'u1');
  assert.equal(r.overdue, 2);
  assert.deepEqual(r.cells, [1, 0, 0, 0, 0, 1]);
  assert.equal(r.total, 4);
});

test('workloadTable: una visita de esta semana con fecha pasada es vencida y no cuenta dos veces', () => {
  const t = workloadTable([v({ownerId: 'u1', dueDate: '2026-11-11'})], '2026-11-12', people);
  assert.equal(rowOf(t, 'u1').overdue, 1);
  assert.equal(rowOf(t, 'u1').cells[0], 0);
});

test('workloadTable: solo abiertas con fecha válida; planes y estados cerrados se excluyen', () => {
  const t = workloadTable([
    v({ownerId: 'u1', status: 'Completada'}), v({ownerId: 'u1', status: 'Cancelada'}),
    v({ownerId: 'u1', type: 'Plan de mantenimiento'}), v({ownerId: 'u1', dueDate: ''}), v({ownerId: 'u1', dueDate: '2026-02-30'}),
    v({ownerId: 'u1', status: 'En curso'}), v({ownerId: 'u1'}),
  ], TODAY, people);
  assert.deepEqual(rowOf(t, 'u1').cells, [2, 0, 0, 0, 0, 0]);
  assert.equal(t.rows.length, 1);
});

test('workloadTable: responsable por ownerId (correo con people), texto owner o «Sin técnico»', () => {
  const t = workloadTable([
    v({ownerId: 'u1', owner: 'Ana P.'}), v({ownerId: 'u9', owner: 'Cuenta antigua'}), v({ownerId: 'u8'}),
    v({owner: ' Carla  '}), v({owner: 'carla'}), v({}),
  ], TODAY, people);
  assert.equal(rowOf(t, 'u1').name, 'ana@e.test');
  assert.equal(rowOf(t, 'u9').name, 'Cuenta antigua');
  assert.equal(rowOf(t, 'u8').name, 'Técnico asignado');
  assert.equal(rowOf(t, 'carla').name, 'Carla');
  assert.equal(rowOf(t, 'carla').cells[0], 2);
  assert.equal(rowOf(t, '').name, 'Sin técnico');
  const noPeople = workloadTable([v({ownerId: 'u1', owner: 'Ana P.'})], TODAY);
  assert.equal(rowOf(noPeople, 'u1').name, 'Ana P.');
});

test('workloadTable: filas ordenadas por nombre y «Sin técnico» siempre al final', () => {
  const t = workloadTable([v({}), v({ownerId: 'u2'}), v({owner: 'Álvaro'}), v({ownerId: 'u1'}), v({owner: 'zeta'})], TODAY, people);
  assert.deepEqual(t.rows.map(r => r.name), ['Álvaro', 'ana@e.test', 'beto@e.test', 'zeta', 'Sin técnico']);
  assert.equal(t.rows.at(-1).key, '');
});

test('workloadTable: filtros de cliente, equipo y técnico, y máximo de la tabla', () => {
  const rows = [v({ownerId: 'u1', customerId: 'c1'}), v({ownerId: 'u1', customerId: 'c1'}), v({ownerId: 'u1', customerId: 'c2', equipmentId: 'e2'}), v({ownerId: 'u2', customerId: 'c1', dueDate: '2026-10-01'})];
  const all = workloadTable(rows, TODAY, people);
  assert.equal(all.max, 3);
  assert.equal(workloadTable(rows, TODAY, people, {customerId: 'c1'}).max, 2);
  assert.deepEqual(workloadTable(rows, TODAY, people, {equipmentId: 'e2'}).rows.map(r => r.key), ['u1']);
  assert.deepEqual(workloadTable(rows, TODAY, people, {ownerId: 'u2'}).rows.map(r => r.key), ['u2']);
  assert.equal(workloadTable(rows, TODAY, people, {ownerId: 'u2'}).max, 1, 'las vencidas cuentan para el máximo');
});

test('workloadTable no muta las entradas', () => {
  const rows = [v({ownerId: 'u1'})], ps = structuredClone(people), copy = structuredClone(rows);
  workloadTable(rows, TODAY, ps);
  assert.deepEqual(rows, copy);
  assert.deepEqual(ps, people);
});

test('workloadCell: lista la celda o las vencidas con el mismo criterio, ordenadas por fecha y prioridad', () => {
  const a = v({id: 'a', ownerId: 'u1', dueDate: '2026-11-12', priority: 'Baja', name: 'B'}), b = v({id: 'b', ownerId: 'u1', dueDate: '2026-11-12', priority: 'Crítica', name: 'A'}), c = v({id: 'c', ownerId: 'u1', dueDate: '2026-11-10'}),
    old = v({id: 'old', ownerId: 'u1', dueDate: '2026-10-30'}), older = v({id: 'older', ownerId: 'u1', dueDate: '2026-10-01'}), other = v({id: 'o', ownerId: 'u2', dueDate: '2026-11-12'}), next = v({id: 'n', ownerId: 'u1', dueDate: '2026-11-16'}), closed = v({id: 'x', ownerId: 'u1', status: 'Completada'});
  const all = [a, b, c, old, older, other, next, closed];
  assert.deepEqual(workloadCell(all, TODAY, people, 'u1', 0).map(x => x.id), ['c', 'b', 'a']);
  assert.deepEqual(workloadCell(all, TODAY, people, 'u1', 1).map(x => x.id), ['n']);
  assert.deepEqual(workloadCell(all, TODAY, people, 'u1', 'overdue').map(x => x.id), ['older', 'old']);
  assert.deepEqual(workloadCell(all, TODAY, people, 'u1', 5), []);
  assert.deepEqual(workloadCell(all, TODAY, people, 'nadie', 0), []);
  assert.deepEqual(workloadCell(all, TODAY, people, 'u1', 0, {customerId: 'zzz'}), []);
  // coherente con la tabla
  const t = workloadTable(all, TODAY, people);
  assert.equal(workloadCell(all, TODAY, people, 'u1', 0).length, rowOf(t, 'u1').cells[0]);
  assert.equal(workloadCell(all, TODAY, people, 'u1', 'overdue').length, rowOf(t, 'u1').overdue);
  assert.equal(workloadCell([v({}), v({owner: '  '})], TODAY, people, '', 0).length, 2);
});

test('reassignVisit: cambia ownerId y owner, marca manualEdit y no muta', () => {
  const visit = v({ownerId: 'u1', owner: 'ana@e.test'}), copy = structuredClone(visit);
  const out = reassignVisit(visit, {ownerId: 'u2', owner: 'beto@e.test'});
  assert.equal(out.ownerId, 'u2'); assert.equal(out.owner, 'beto@e.test'); assert.equal(out.manualEdit, '1');
  assert.deepEqual(visit, copy);
  assert.notEqual(out, visit);
  const none = reassignVisit(visit, {ownerId: '', owner: ''});
  assert.equal(none.ownerId, ''); assert.equal(none.owner, ''); assert.equal(none.manualEdit, '1');
  const text = reassignVisit(v({}), {ownerId: '', owner: '  Carla '});
  assert.equal(text.owner, 'Carla'); assert.equal(text.ownerId, '');
});

test('reassignVisit: null si no hay cambio o la visita ya no está Planificada', () => {
  assert.equal(reassignVisit(v({ownerId: 'u1', owner: 'ana@e.test'}), {ownerId: 'u1', owner: 'ana@e.test'}), null);
  assert.equal(reassignVisit(v({ownerId: 'u1', owner: 'Ana'}), {ownerId: 'u1', owner: 'ana@e.test'}), null, 'misma cuenta');
  assert.equal(reassignVisit(v({owner: 'Carla'}), {ownerId: '', owner: ' Carla '}), null);
  assert.equal(reassignVisit(v({}), {ownerId: '', owner: ''}), null);
  for (const status of ['En curso', 'Completada', 'Cancelada']) assert.equal(reassignVisit(v({status, ownerId: 'u1'}), {ownerId: 'u2', owner: 'beto@e.test'}), null, status);
});

test('planReadonlyData: prepara los datos del plan para el técnico', () => {
  const plan = {id: 'p1', name: 'Plan bombas', equipmentId: 'e1', anchorDate: '2026-11-20', dueDate: '2026-11-20', intervalDays: '30', owner: 'Ana', ownerId: 'u1', reportTemplate: 'generator', scope: 'Revisar sellos', planState: 'Pausado',
    anchorHistory: JSON.stringify([{from: '2026-10-20', to: '2026-10-25', by: 'x', visitId: 'visit-p1-20261020'}, {from: '2026-11-20', to: '2026-11-22', by: 'y'}])};
  const equipment = [{id: 'e1', name: 'Bomba 1', tag: 'EQ-1'}];
  const visits = [v({planId: 'p1', dueDate: '2026-11-30'}), v({planId: 'p1', dueDate: '2026-11-12'}), v({planId: 'p1', dueDate: '2026-11-05'}), v({planId: 'p1', dueDate: '2026-11-10', status: 'Cancelada'}), v({planId: 'p2', dueDate: '2026-11-09'})];
  const d = planReadonlyData(plan, visits, equipment, TODAY);
  assert.equal(d.name, 'Plan bombas'); assert.equal(d.equipment, 'EQ-1 · Bomba 1');
  assert.equal(d.anchorDate, '2026-11-20'); assert.equal(d.intervalDays, '30');
  assert.equal(d.owner, 'Ana'); assert.equal(d.template, 'Grupo electrógeno');
  assert.equal(d.scope, 'Revisar sellos'); assert.equal(d.state, 'Pausado');
  assert.equal(d.next, '', 'pausado no tiene próxima visita');
  assert.deepEqual(d.history, [{from: '2026-10-20', to: '2026-10-25'}, {from: '2026-11-20', to: '2026-11-22'}]);
  const active = planReadonlyData({...plan, planState: 'Activo'}, visits, equipment, TODAY);
  assert.equal(active.state, 'Activo'); assert.equal(active.next, '2026-11-12');
  const bare = planReadonlyData({id: 'p9', name: 'X', equipmentId: 'zz', dueDate: '2026-12-01', intervalDays: '7', anchorHistory: '{no es json'}, [], [], TODAY);
  assert.equal(bare.equipment, 'Equipo no disponible'); assert.equal(bare.anchorDate, '2026-12-01'); assert.equal(bare.state, 'Activo'); assert.equal(bare.owner, 'Sin técnico');
  assert.equal(bare.template, 'Informe general'); assert.deepEqual(bare.history, []); assert.equal(bare.next, '');
  assert.equal(planReadonlyData({...plan, ownerId: 'u1', owner: ''}, [], equipment, TODAY, people).owner, 'ana@e.test');
});

test('el rol de un técnico sin plan editable: canGenerateVisits sigue negando a técnicos y a «none»', () => {
  assert.equal(canGenerateVisits({role: 'technician'}), false);
  assert.equal(canGenerateVisits(null, 'none'), false);
  assert.equal(canGenerateVisits(null, ''), true);
  assert.equal(canGenerateVisits({role: 'supervisor'}), true);
});

async function loadSync(calls, failLogout = false) {
  const key = 'planLoad' + Math.random().toString(36).slice(2);
  globalThis[key] = {
    store: {async setMeta(id, value) { calls.push(['setMeta', id, value]); }},
    navigator: {onLine: true}, setTimeout: () => 0, clearTimeout() {}, FileReader: class {},
    async fetch(path) { calls.push(['fetch', path]); if (failLogout) return {ok: false, status: 500, async json() { return {error: 'falla'}; }}; return {ok: true, status: 200, async json() { return {ok: true}; }}; },
  };
  let source = readFileSync(new URL('../public/js/sync.js', import.meta.url), 'utf8').replace("import * as store from './store.js';", `const store=globalThis['${key}'].store;`);
  source = source.replace(/from '(\.\/[^']+)'/g, (_, rel) => `from '${new URL('../public/js/' + rel.slice(2), import.meta.url).href}'`);
  source = `const {navigator,fetch,setTimeout,clearTimeout,FileReader}=globalThis['${key}'];\n` + source;
  return {sync: await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')), done: () => delete globalThis[key]};
}

test('cerrar sesión guarda lastRole «none» tras llamar al servidor', async () => {
  const calls = [], h = await loadSync(calls);
  try {
    h.sync.syncState.user = {id: 'u1', role: 'technician'};
    await h.sync.logout();
    assert.deepEqual(calls.map(c => c[0] + ':' + (c[1] || '')), ['fetch:/api/logout', 'setMeta:lastRole']);
    assert.equal(calls[1][2], 'none');
    assert.equal(h.sync.syncState.user, null);
  } finally { h.done(); }
});

test('si el servidor rechaza cerrar sesión no se cambia el rol guardado', async () => {
  const calls = [], h = await loadSync(calls, true);
  try {
    await assert.rejects(h.sync.logout());
    assert.equal(calls.some(c => c[0] === 'setMeta'), false);
  } finally { h.done(); }
});
