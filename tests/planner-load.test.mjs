import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planReadonlyData} from '../public/js/planner.js';
import {canGenerateVisits} from '../public/js/planner-ui.js';

const TODAY = '2026-11-09'; // lunes
const v = (o = {}) => ({id: 'v' + Math.random(), name: 'Visita', type: 'Orden de trabajo', planId: 'p1', status: 'Planificada', priority: 'Media', dueDate: TODAY, ownerId: '', owner: '', customerId: '', equipmentId: '', ...o});
const people = [{id: 'u1', email: 'ana@e.test', role: 'technician'}, {id: 'u2', email: 'beto@e.test', role: 'supervisor'}];
const rowOf = (t, key) => t.rows.find(r => r.key === key);

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
