import test from 'node:test';
import assert from 'node:assert/strict';
import {complianceStats,complianceCsv,complianceFileName,completionDate,workloadTable} from '../public/js/planner.js';
const TODAY='2026-11-11';
let n=0;
const v=(o={})=>({id:'v'+(++n),name:'Visita',type:'Orden de trabajo',planId:'p1',status:'Planificada',priority:'Media',dueDate:'2026-11-05',ownerId:'',owner:'',customerId:'',equipmentId:'',reportId:'',...o});
const done=(due,at,o={})=>[v({status:'Completada',dueDate:due,reportId:'r-'+due+'-'+at,...o}),{id:'r-'+due+'-'+at,serviceDate:at}];
const split=list=>({visits:list.flat().filter(x=>x.planId),reports:list.flat().filter(x=>!x.planId)});
const stats=(list,days=90,people=[],filters={},today=TODAY)=>{const {visits,reports}=split(list);return complianceStats(visits,reports,today,days,people,filters);};

test('ventana: [hoy-(N-1), hoy] para 30, 90 y 180 días',()=>{
  assert.deepEqual([30,90,180].map(d=>{const s=stats([],d);return [s.from,s.to,s.days];}),[['2026-10-13',TODAY,30],['2026-08-14',TODAY,90],['2026-05-16',TODAY,180]]);
});
test('ventana de 30 días: primer día dentro, día anterior fuera, hoy completado dentro, hoy abierto fuera',()=>{
  const s=stats([done('2026-10-13','2026-10-13'),done('2026-10-12','2026-10-12'),[v({dueDate:'2026-11-10'})],[v({dueDate:TODAY})],done(TODAY,TODAY)],30);
  assert.equal(s.measured,3);assert.equal(s.completed,2);assert.equal(s.openOverdue,1);
  assert.deepEqual(s.details.map(d=>d.dueDate),['2026-10-13','2026-11-10',TODAY]);
});
test('ventanas de 90 y 180 días: bordes exactos',()=>{
  const l=[done('2026-08-14','2026-08-14'),done('2026-08-13','2026-08-13'),done('2026-05-16','2026-05-16'),done('2026-05-15','2026-05-15')];
  assert.deepEqual(stats(l,90).details.map(d=>d.dueDate),['2026-08-14']);
  assert.deepEqual(stats(l,180).details.map(d=>d.dueDate),['2026-05-16','2026-08-13','2026-08-14']);
});
test('definiciones con números exactos',()=>{
  const s=stats([done('2026-11-01','2026-11-01'),done('2026-11-02','2026-11-01'),done('2026-11-03','2026-11-06'),done('2026-11-04','2026-11-08'),[v({status:'Completada',dueDate:'2026-11-05'})],[v({dueDate:'2026-11-06'})],[v({status:'En curso',dueDate:'2026-11-07'})]]);
  assert.deepEqual([s.measured,s.completed,s.onTime,s.late,s.unknownDate,s.openOverdue,s.oldestOverdueDays],[7,5,2,2,1,2,5]);
  assert.deepEqual([s.compliancePct,s.punctualityPct,s.avgLateDays],[71,50,3.5]);
  const d=s.details;
  assert.deepEqual(d.map(x=>x.lateDays),[0,0,3,4,'',5,4]);
  assert.equal(d[0].doneDate,'2026-11-01');assert.equal(d[4].doneDate,'');
});
test('realizada el mismo día de lo programado es a tiempo y no cuenta atraso',()=>{
  const s=stats([done('2026-11-03','2026-11-03')]);
  assert.deepEqual([s.onTime,s.late,s.punctualityPct,s.avgLateDays],[1,0,100,null]);
});
test('fecha desconocida: sin informe, informe borrado, fecha inválida o informe inexistente cuentan como completadas sin puntualidad ni atraso',()=>{
  const reports=[{id:'rd',serviceDate:'2026-11-09',_sync:{deleted:true}},{id:'rx',serviceDate:'2026-13-45'},{id:'ry',serviceDate:''}];
  const visits=[v({status:'Completada'}),v({status:'Completada',reportId:'rd'}),v({status:'Completada',reportId:'rx'}),v({status:'Completada',reportId:'ry'}),v({status:'Completada',reportId:'nada'})];
  const s=complianceStats(visits,reports,TODAY,90,[]);
  assert.deepEqual([s.measured,s.completed,s.unknownDate,s.onTime,s.late],[5,5,5,0,0]);
  assert.deepEqual([s.compliancePct,s.punctualityPct,s.avgLateDays],[100,null,null]);
});
test('Cancelada, planes, sin fecha, fecha inválida, futuras y la de hoy abierta quedan fuera',()=>{
  const s=stats([[v({status:'Cancelada'})],[v({type:'Plan de mantenimiento',status:'Completada'})],[v({dueDate:''})],[v({dueDate:'2026-02-30'})],[v({dueDate:'2026-11-12'})],[v({status:'Completada',dueDate:'2026-11-20'})],[v({dueDate:TODAY})],[v({status:'En curso',dueDate:TODAY})]]);
  assert.equal(s.measured,0);assert.deepEqual(s.details,[]);
});
test('una completada con fecha programada futura no se mide',()=>{
  assert.equal(stats([done('2026-11-12','2026-11-11')]).measured,0);
});
test('denominadores 0: porcentajes y atraso son null, nunca 0 ni NaN',()=>{
  const s=stats([]);
  assert.deepEqual([s.measured,s.completed,s.compliancePct,s.punctualityPct,s.avgLateDays,s.oldestOverdueDays,s.openOverdue],[0,0,null,null,null,null,0]);
  assert.deepEqual(s.rows,[]);
  const only=stats([[v()]]);// solo una vencida abierta: cumplimiento 0 %, puntualidad sin datos
  assert.deepEqual([only.compliancePct,only.punctualityPct,only.avgLateDays],[0,null,null]);
});
test('una fecha de realización futura se trata como desconocida y no distorsiona el atraso',()=>{
  const s=stats([done('2026-11-01','2062-11-03'),done('2026-11-02','2026-11-04'),done('2026-11-03','2026-11-03')]);
  assert.deepEqual([s.unknownDate,s.onTime,s.late,s.avgLateDays,s.completed],[1,1,1,2,3]);
});
test('100 % y 0 % solo cuando son exactos',()=>{
  const mk=(c,t)=>stats([...Array.from({length:c},()=>done('2026-11-01','2026-11-01')),...Array.from({length:t-c},()=>[v()])]);
  assert.deepEqual([[199,200],[1,201],[0,5],[5,5]].map(([c,t])=>mk(c,t).compliancePct),[99,1,0,100]);
  const s=mk(199,200);assert.equal(s.rows[0].compliancePct,99);assert.equal(s.months.at(-1).pct,99);
});
test('redondeo de porcentajes a enteros',()=>{
  const mk=(c,t)=>stats([...Array.from({length:c},()=>done('2026-11-01','2026-11-01')),...Array.from({length:t-c},()=>[v()])]).compliancePct;
  assert.deepEqual([mk(1,3),mk(2,3),mk(1,8),mk(5,6),mk(6,6),mk(0,4)],[33,67,13,83,100,0]);
});
test('filtros por técnico, cliente y equipo',()=>{
  const l=[done('2026-11-01','2026-11-01',{ownerId:'u1',customerId:'c1',equipmentId:'e1'}),done('2026-11-02','2026-11-03',{ownerId:'u2',customerId:'c2',equipmentId:'e2'}),[v({ownerId:'u1',customerId:'c2',equipmentId:'e1'})]];
  assert.equal(stats(l,90,[],{ownerId:'u1'}).measured,2);
  assert.equal(stats(l,90,[],{customerId:'c2'}).measured,2);
  assert.equal(stats(l,90,[],{equipmentId:'e2'}).measured,1);
  assert.equal(stats(l,90,[],{ownerId:'u1',customerId:'c1',equipmentId:'e1'}).measured,1);
  assert.equal(stats(l,90,[],{ownerId:'zz'}).measured,0);
});
test('por técnico: ownerId con people, texto, «Sin técnico», sufijo «(sin cuenta)» y orden por cumplimiento ascendente y nombre',()=>{
  const people=[{id:'u1',email:'ana@e.test'}];
  const l=[done('2026-11-01','2026-11-01',{ownerId:'u1'}),[v({ownerId:'u1'})],
    done('2026-11-01','2026-11-05',{owner:'Beto Soto'}),[v({owner:'Carlos'})],done('2026-11-02','2026-11-02'),done('2026-11-03','2026-11-03',{owner:'ANA@e.test'})];
  const s=stats(l,90,people);
  assert.deepEqual(s.rows.map(r=>[r.name,r.measured,r.completed,r.onTime,r.late,r.openOverdue,r.compliancePct]),[
    ['Carlos',1,0,0,0,1,0],['ana@e.test',2,1,1,0,1,50],['ANA@e.test (sin cuenta)',1,1,1,0,0,100],['Beto Soto',1,1,0,1,0,100],['Sin técnico',1,1,1,0,0,100]]);
  assert.equal(s.rows.length,5);
});
test('por técnico reutiliza la resolución de Carga: mismos nombres que workloadTable',()=>{
  const people=[{id:'u1',email:'ana@e.test'}],open=[v({ownerId:'u1'}),v({owner:'Ana@E.test'}),v({owner:'Beto'}),v()];
  const names=new Map(workloadTable(open,TODAY,people).rows.map(r=>[r.key,r.name])),k=complianceStats(open,[],TODAY,90,people).rows;
  assert.deepEqual(k.map(r=>[r.key,r.name]).sort(),[...names].sort());
});
test('meses: cruzan el año (dic→ene) y llevan etiqueta en español',()=>{
  const s=stats([done('2026-10-05','2026-10-05'),done('2026-12-15','2026-12-20'),[v({dueDate:'2027-01-01'})]],90,[],{},'2027-01-02');
  assert.equal(s.from,'2026-10-05');
  assert.deepEqual(s.months.map(m=>[m.ym,m.label,m.measured,m.completed,m.pct]),[['2026-10','oct 2026',1,1,100],['2026-11','nov 2026',0,0,null],['2026-12','dic 2026',1,1,100],['2027-01','ene 2027',1,0,0]]);
});
test('meses: 180 días tocan 7 meses; febrero bisiesto cuenta el 29 y el no bisiesto lo salta',()=>{
  const s=stats([],180);assert.deepEqual(s.months.map(m=>m.label),['may 2026','jun 2026','jul 2026','ago 2026','sep 2026','oct 2026','nov 2026']);
  const b=stats([done('2028-02-29','2028-02-29'),done('2028-01-31','2028-01-31')],30,[],{},'2028-03-01');
  assert.equal(b.from,'2028-02-01');assert.deepEqual(b.months.map(m=>[m.ym,m.measured]),[['2028-02',1],['2028-03',0]]);
  const c=stats([done('2027-01-31','2027-01-31'),done('2027-02-28','2027-02-28')],30,[],{},'2027-03-01');
  assert.equal(c.from,'2027-01-31');assert.deepEqual(c.months.map(m=>[m.ym,m.measured]),[['2027-01',1],['2027-02',1],['2027-03',0]]);
});
test('el cambio de hora no altera la ventana (aritmética UTC)',()=>{
  const saved=process.env.TZ;try{for(const tz of ['America/Santiago','UTC','Pacific/Auckland']){process.env.TZ=tz;assert.equal(stats([],30,[],{},'2026-09-10').from,'2026-08-12');assert.equal(stats([],30,[],{},'2026-04-10').from,'2026-03-12');}}finally{if(saved===undefined)delete process.env.TZ;else process.env.TZ=saved;}
});
test('no muta visitas, informes, personas ni filtros',()=>{
  const {visits,reports}=split([done('2026-11-01','2026-11-03',{owner:'Ana'}),[v()]]),people=[{id:'u1',email:'a@e.test'}],filters={ownerId:''};
  const deep=o=>{Object.values(o).forEach(x=>x&&typeof x==='object'&&deep(x));return Object.freeze(o);};
  [visits,reports,people,filters].forEach(deep);
  assert.doesNotThrow(()=>{const s=complianceStats(visits,reports,TODAY,90,people,filters);complianceCsv(s);});
});
test('completionDate: serviceDate del informe vinculado vivo; vacío si no hay o es inválida',()=>{
  const reports=[{id:'a',serviceDate:'2026-11-09'},{id:'b',serviceDate:'2026-11-09',_sync:{deleted:true}},{id:'c',serviceDate:'09/11/2026'}];
  assert.equal(completionDate({reportId:'a'},reports),'2026-11-09');
  assert.deepEqual(['b','c','z',''].map(id=>completionDate({reportId:id},reports)),['','','','']);
  assert.equal(completionDate({},reports),'');
});
test('CSV: BOM, separador «;», CRLF, comillas y saltos de línea escapados',()=>{
  const s=stats([done('2026-11-01','2026-11-03',{name:'Revisión "A"; sello\nnuevo',owner:'Ana'}),[v({name:'Otra'})]]);
  const csv=complianceCsv(s),lines=csv.split('\r\n');
  assert.equal(csv.charCodeAt(0),0xFEFF);assert.ok(csv.endsWith('\r\n'));
  assert.equal(lines[0],'﻿Fecha programada;Fecha realizada;Estado;Días de atraso;Plan;Equipo;Técnico');
  assert.equal(lines[1],'2026-11-01;2026-11-03;Completada;2;"Revisión ""A""; sello\nnuevo";;Ana');
  assert.equal(lines[2],'2026-11-05;;Vencida;6;Otra;;Sin técnico');
  assert.equal(lines.length,4);
});
test('CSV: celdas que empiezan por = + - @ o tabulación se prefijan con apóstrofo',()=>{
  const names=['=1+1','+SUMA(A1)','-2','@cmd','\tx','normal'],s=stats(names.map(name=>[v({name})]));
  const rows=complianceCsv(s).split('\r\n').slice(1,-1).map(l=>l.split(';')[4]);
  assert.deepEqual(rows.sort(),["'+SUMA(A1)","'-2","'=1+1","'@cmd","'\tx",'normal'].sort());
  assert.equal(complianceCsv(stats([])).split('\r\n').length,2);
});
test('nombre de archivo del CSV usa la fecha de hoy',()=>{assert.equal(complianceFileName(TODAY),'planner-indicadores-2026-11-11.csv');});
