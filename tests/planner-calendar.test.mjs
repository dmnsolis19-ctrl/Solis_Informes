import test from 'node:test';
import assert from 'node:assert/strict';
import {monthGrid,shiftMonth,visitTone} from '../public/js/planner.js';
const v=(o={})=>({id:'v'+Math.random(),name:'Visita',type:'Orden de trabajo',planId:'p1',status:'Planificada',priority:'Media',dueDate:'2026-11-09',ownerId:'',customerId:'',equipmentId:'',...o});
const flat=g=>g.weeks.flat(),cell=(g,d)=>flat(g).find(x=>x.date===d);
const TODAY='2026-11-09';

test('monthGrid: semana desde el lunes; noviembre 2026 parte en domingo y la primera fila empieza el lunes 26 de octubre',()=>{
  const g=monthGrid([],2026,11,TODAY);
  assert.equal(g.year,2026);assert.equal(g.month,11);
  assert.equal(g.weeks[0][0].date,'2026-10-26');assert.equal(g.weeks[0][6].date,'2026-11-01');
  assert.equal(g.weeks[0][0].inMonth,false);assert.equal(g.weeks[0][6].inMonth,true);
  assert.equal(g.weeks.length,6);
});
test('monthGrid: cada semana tiene 7 días consecutivos y la cuadrícula termina en domingo',()=>{
  for(const [y,m] of [[2026,11],[2026,2],[2028,2],[2026,4],[2026,12],[2027,1]]){
    const g=monthGrid([],y,m,TODAY),days=flat(g);
    assert.ok(g.weeks.length>=4&&g.weeks.length<=6,`${y}-${m}`);
    for(const w of g.weeks)assert.equal(w.length,7);
    assert.equal(days.length%7,0);
    for(let i=1;i<days.length;i++)assert.equal(new Date(days[i].date+'T12:00:00Z')-new Date(days[i-1].date+'T12:00:00Z'),864e5);
    assert.equal(new Date(days[0].date+'T12:00:00Z').getUTCDay(),1,'empieza en lunes');
    assert.equal(new Date(days.at(-1).date+'T12:00:00Z').getUTCDay(),0,'termina en domingo');
  }
});
test('monthGrid: meses de 28, 29, 30 y 31 días',()=>{
  const count=(y,m)=>flat(monthGrid([],y,m,TODAY)).filter(d=>d.inMonth).length;
  assert.equal(count(2026,2),28);assert.equal(count(2028,2),29);assert.equal(count(2026,4),30);assert.equal(count(2026,12),31);
});
test('monthGrid: febrero 2026 (28 días, empieza en domingo) y febrero 2028 bisiesto',()=>{
  const f26=monthGrid([],2026,2,TODAY);
  assert.equal(f26.weeks[0][0].date,'2026-01-26');assert.equal(f26.weeks.length,5);
  const f28=monthGrid([],2028,2,TODAY),inM=flat(f28).filter(d=>d.inMonth);
  assert.equal(inM.at(-1).date,'2028-02-29');
  assert.equal(f28.weeks[0][0].date,'2028-01-31');
});
test('monthGrid: un mes de 28 días que empieza en lunes ocupa exactamente 4 semanas sin relleno',()=>{
  const g=monthGrid([],2027,2,TODAY);
  assert.equal(g.weeks.length,4);assert.ok(flat(g).every(d=>d.inMonth));
});
test('monthGrid: relleno con días de los meses vecinos y cruce de año',()=>{
  const g=monthGrid([],2027,1,TODAY);
  assert.equal(g.weeks[0][0].date,'2026-12-28');assert.equal(g.weeks[0][0].inMonth,false);
  const dec=monthGrid([],2026,12,TODAY);
  assert.equal(dec.weeks.at(-1).at(-1).date,'2027-01-03');assert.equal(dec.weeks.at(-1).at(-1).inMonth,false);
});
test('monthGrid: marca solo el día de hoy',()=>{
  const g=monthGrid([],2026,11,TODAY),t=flat(g).filter(d=>d.isToday);
  assert.equal(t.length,1);assert.equal(t[0].date,TODAY);
  assert.equal(flat(monthGrid([],2026,12,TODAY)).some(d=>d.isToday),false);
});
test('monthGrid: un día con visitas en varios estados; Cancelada excluida',()=>{
  const rows=[v({id:'a',name:'A'}),v({id:'b',name:'B',status:'En curso'}),v({id:'c',name:'C',status:'Completada'}),v({id:'d',name:'D',status:'Cancelada'})];
  const c=cell(monthGrid(rows,2026,11,TODAY),'2026-11-09');
  assert.deepEqual(c.visits.map(x=>x.id).sort(),['a','b','c']);
});
test('monthGrid: ignora planes, fechas inválidas y ausentes',()=>{
  const rows=[v({id:'ok'}),v({id:'plan',type:'Plan de mantenimiento'}),v({id:'x',dueDate:''}),v({id:'y',dueDate:'2026-02-30'}),v({id:'z',dueDate:'09/11/2026'}),v({id:'w',dueDate:undefined})];
  const g=monthGrid(rows,2026,11,TODAY),all=flat(g).flatMap(d=>d.visits);
  assert.deepEqual(all.map(x=>x.id),['ok']);
});
test('monthGrid: una visita el último día del mes aparece en esa celda; días vecinos también muestran visitas',()=>{
  const g=monthGrid([v({id:'fin',dueDate:'2026-11-30'}),v({id:'oct',dueDate:'2026-10-27'}),v({id:'lejos',dueDate:'2027-03-01'})],2026,11,TODAY);
  assert.deepEqual(cell(g,'2026-11-30').visits.map(x=>x.id),['fin']);assert.equal(cell(g,'2026-11-30').inMonth,true);
  assert.deepEqual(cell(g,'2026-10-27').visits.map(x=>x.id),['oct']);assert.equal(cell(g,'2026-10-27').inMonth,false);
  assert.equal(flat(g).flatMap(d=>d.visits).some(x=>x.id==='lejos'),false);
  const dec=monthGrid([v({id:'fin',dueDate:'2026-12-31'})],2026,12,TODAY);
  assert.deepEqual(cell(dec,'2026-12-31').visits.map(x=>x.id),['fin']);
});
test('monthGrid: filtros por técnico, cliente y equipo',()=>{
  const rows=[v({id:'a',ownerId:'u1',customerId:'c1',equipmentId:'e1'}),v({id:'b',ownerId:'u2',customerId:'c1',equipmentId:'e2'}),v({id:'c',ownerId:'u1',customerId:'c2',equipmentId:'e1'})];
  const ids=f=>cell(monthGrid(rows,2026,11,TODAY,f),'2026-11-09').visits.map(x=>x.id).sort();
  assert.deepEqual(ids(),['a','b','c']);assert.deepEqual(ids({}),['a','b','c']);
  assert.deepEqual(ids({ownerId:'u1'}),['a','c']);assert.deepEqual(ids({customerId:'c1'}),['a','b']);
  assert.deepEqual(ids({equipmentId:'e1'}),['a','c']);assert.deepEqual(ids({ownerId:'u1',customerId:'c1',equipmentId:'e1'}),['a']);
  assert.deepEqual(ids({ownerId:''}),['a','b','c']);
});
test('monthGrid: orden por prioridad y luego por nombre',()=>{
  const rows=[v({id:'1',name:'Zeta',priority:'Baja'}),v({id:'2',name:'Beta',priority:'Media'}),v({id:'3',name:'Alfa',priority:'Media'}),v({id:'4',name:'Omega',priority:'Crítica'}),v({id:'5',name:'Pi',priority:'Alta'})];
  assert.deepEqual(cell(monthGrid(rows,2026,11,TODAY),'2026-11-09').visits.map(x=>x.id),['4','5','3','2','1']);
});
test('monthGrid: no muta las entradas',()=>{
  const rows=[v({id:'a',name:'B',priority:'Baja'}),v({id:'b',name:'A',priority:'Alta'})],snap=JSON.stringify(rows),filters={ownerId:'u1'},fs=JSON.stringify(filters);
  const g=monthGrid(rows,2026,11,TODAY,filters);
  assert.equal(JSON.stringify(rows),snap);assert.equal(JSON.stringify(filters),fs);
  cell(g,'2026-11-09').visits.push('x');assert.equal(JSON.stringify(rows),snap);
});
test('shiftMonth: avanza, retrocede y cruza años',()=>{
  assert.deepEqual(shiftMonth(2026,11,1),{year:2026,month:12});
  assert.deepEqual(shiftMonth(2026,12,1),{year:2027,month:1});
  assert.deepEqual(shiftMonth(2027,1,-1),{year:2026,month:12});
  assert.deepEqual(shiftMonth(2026,5,-1),{year:2026,month:4});
  assert.deepEqual(shiftMonth(2026,1,-13),{year:2024,month:12});
  assert.deepEqual(shiftMonth(2026,6,0),{year:2026,month:6});
  assert.deepEqual(shiftMonth(2026,11,14),{year:2028,month:1});
});
test('visitTone: vencida, en curso, hecha y planificada',()=>{
  assert.equal(visitTone(v({status:'Planificada',dueDate:'2026-11-08'}),TODAY),'overdue');
  assert.equal(visitTone(v({status:'En curso',dueDate:'2026-11-08'}),TODAY),'overdue');
  assert.equal(visitTone(v({status:'En curso',dueDate:TODAY}),TODAY),'progress');
  assert.equal(visitTone(v({status:'En curso',dueDate:'2026-11-20'}),TODAY),'progress');
  assert.equal(visitTone(v({status:'Completada',dueDate:'2026-10-01'}),TODAY),'done');
  assert.equal(visitTone(v({status:'Planificada',dueDate:TODAY}),TODAY),'planned');
  assert.equal(visitTone(v({status:'Planificada',dueDate:'2026-12-01'}),TODAY),'planned');
});
