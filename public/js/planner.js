import {newOperation,normalizeOperation} from './operations.js';
import {localDate,templates} from './domain.js';
export const PLANNER_HORIZON_DAYS=90;
const ISO=/^\d{4}-\d{2}-\d{2}$/,dayNum=iso=>Math.round(Date.UTC(+iso.slice(0,4),+iso.slice(5,7)-1,+iso.slice(8,10))/864e5);
export const validIso=s=>ISO.test(s||'')&&localDate(new Date(s+'T12:00:00'))===s;
export function addDays(iso,days){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return localDate(d);}
export const visitId=(planId,iso)=>('visit-'+planId+'-'+iso.replaceAll('-','')).slice(0,100);
export const planAnchor=plan=>plan.anchorDate||plan.dueDate;
export function isPlanActive(plan,equipmentIds){return ['','Activo'].includes(plan.planState||'')&&plan.status!=='Cancelada'&&equipmentIds.has(plan.equipmentId)&&/^\d+$/.test(plan.intervalDays||'')&&Number(plan.intervalDays)>=1&&validIso(planAnchor(plan));}
export function newVisit(plan,iso){const v=newOperation('workOrders',plan.companyId);for(const k of ['name','customerId','siteId','equipmentId','owner','ownerId','priority','scope','materials','reportTemplate'])v[k]=plan[k]??v[k];return Object.assign(v,{id:visitId(plan.id,iso),type:'Orden de trabajo',status:'Planificada',planId:plan.id,dueDate:iso});}
// Tras correr el calendario la ancla es la fecha de la visita ya realizada: esa fecha no genera otra visita.
const doneAnchor=plan=>{try{const h=JSON.parse(plan.anchorHistory||'[]'),l=Array.isArray(h)?h[h.length-1]:null;return l&&l.to===plan.anchorDate?plan.anchorDate:'';}catch{return '';}};
// Ventana [hoy, hoy+horizonte] inclusive; nunca fechas pasadas.
// Campos de la visita que siguen al plan mientras la visita no se haya tocado.
const FOLLOW=['name','owner','ownerId','priority','scope','materials','reportTemplate'];
// Copia de la visita con los valores actuales del plan, o null si no cambia nada o la visita ya no sigue al plan (no Planificada, edición manual o fecha pasada).
export function refreshVisitFromPlan(plan,visit,today){if(visit.status!=='Planificada'||visit.manualEdit==='1'||!(visit.dueDate>=today))return null;const out={...visit};let changed=false;for(const k of FOLLOW)if(plan[k]!==undefined&&plan[k]!==(visit[k]??'')){out[k]=plan[k];changed=true;}return changed?out:null;}
export function ensureOccurrences(plan,visits,today,equipmentIds,horizon=PLANNER_HORIZON_DAYS){if(!validIso(today)||!Number.isFinite(horizon)||!isPlanActive(plan,equipmentIds))return [];const anchor=planAnchor(plan),n=Number(plan.intervalDays),diff=dayNum(today)-dayNum(anchor),first=diff<=0?anchor:addDays(anchor,Math.ceil(diff/n)*n),last=addDays(today,horizon),have=new Map(visits.filter(v=>v.planId===plan.id).map(v=>[v.id,v])),skip=doneAnchor(plan),out=[];for(let d=first;d<=last;d=addDays(d,n)){if(d===skip)continue;const id=visitId(plan.id,d),ex=have.get(id);if(!ex)out.push(newVisit(plan,d));else if(ex.status==='Cancelada'&&ex.closedReason==='calendario corrido'&&ex.dueDate>=today){const r={...ex,status:'Planificada',closedReason:''};for(const k of FOLLOW)r[k]=plan[k]??ex[k];out.push(r);}}return out;}
const CLOSED='calendario corrido',PLAN_CLOSED='plan cerrado',MAX_HISTORY=50;
const cancellable=(v,today)=>v.status==='Planificada'&&v.manualEdit!=='1'&&v.dueDate>=today;
// Cancela (copias) las visitas futuras Planificada sin edición manual y devuelve las que faltan según la ancla actual.
// Si una visita a cancelar coincide por id con una fecha nueva, se conserva (no se cancela ni se duplica).
export function regeneratePlan(plan,visits,today,equipmentIds,fromDate=today){const start=fromDate>today?fromDate:today,own=visits.filter(v=>v.planId===plan.id),wanted=new Set(ensureOccurrences(plan,[],start,equipmentIds).map(v=>v.id)),cancel=own.filter(v=>cancellable(v,today)&&!wanted.has(v.id)).map(v=>({...v,status:'Cancelada',closedReason:CLOSED})),gone=new Set(cancel.map(v=>v.id)),keep=own.filter(v=>!gone.has(v.id));return {cancel,create:ensureOccurrences(plan,keep,start,equipmentIds)};}
// Al cerrar un plan: cancela (copias) sus visitas futuras Planificadas sin edición manual. Idempotente: las ya canceladas no se devuelven.
export function cancelFutureVisits(plan,visits,today){return visits.filter(v=>v.planId===plan.id&&cancellable(v,today)).map(v=>({...v,status:'Cancelada',closedReason:PLAN_CLOSED}));}
export function closeVisit(plan,visits,visit,doneDate,mode,today,actor,equipmentIds){if(!['keep','shift'].includes(mode))throw new Error('Modo de cierre inválido.');const done={...visit,status:'Completada',notes:[visit.notes,'Realizada el '+doneDate+'.'].filter(Boolean).join('\n')},rest=visits.map(v=>v.id===visit.id?done:v);if(mode==='keep')return {plan,visit:done,cancel:[],create:ensureOccurrences(plan,rest,today,equipmentIds)};let hist=[];try{const h=JSON.parse(plan.anchorHistory||'[]');if(Array.isArray(h))hist=h;}catch{}hist.push({from:visit.dueDate,to:doneDate,by:actor,at:new Date().toISOString(),visitId:visit.id});const next={...plan,anchorDate:doneDate,anchorHistory:JSON.stringify(hist.slice(-MAX_HISTORY))},r=regeneratePlan(next,rest,today,equipmentIds,doneDate);return {plan:next,visit:done,cancel:r.cancel,create:r.create.filter(v=>v.dueDate>doneDate)};}
export const visitsToClose=(visits,reports)=>{const ok=new Set(reports.filter(r=>r.status==='Emitido').map(r=>r.id));return visits.filter(v=>v.status==='En curso'&&v.reportId&&ok.has(v.reportId));};
export const isLate=(visit,report)=>report.serviceDate>visit.dueDate;
const PRIO={'Crítica':0,'Alta':1,'Media':2,'Baja':3};
// Visitas abiertas agrupadas por urgencia respecto a hoy; ignora planes, cerradas y fechas inválidas.
export function urgencyBuckets(visits,today,filters={}){const out={overdue:[],today:[],week:[],next30:[]},w=addDays(today,7),m=addDays(today,30),f=['ownerId','customerId','equipmentId'].filter(k=>filters[k]);for(const v of visits){if(v.type==='Plan de mantenimiento'||!['Planificada','En curso'].includes(v.status)||!validIso(v.dueDate)||f.some(k=>v[k]!==filters[k]))continue;const d=v.dueDate;(d<today?out.overdue:d===today?out.today:d<=w?out.week:d<=m?out.next30:null)?.push(v);}for(const k in out)out[k].sort((a,b)=>a.dueDate<b.dueDate?-1:a.dueDate>b.dueDate?1:(PRIO[a.priority]??4)-(PRIO[b.priority]??4));return out;}
// Un plan activo por equipo seleccionado; cliente e instalación salen del equipo. Valida con normalizeOperation.
export function plansFromForm(form,equipment,companyId,planIds={}){const ids=[...new Set(form.equipmentIds||[])];if(!ids.length)throw new Error('Selecciona al menos un equipo.');const anchor=form.anchorDate||'',interval=String(form.intervalDays||'').trim();if(!validIso(anchor)||!/^\d+$/.test(interval)||Number(interval)<1)throw new Error('Define fecha ancla y periodicidad.');const rows=ids.map(id=>{const eq=equipment.find(x=>x.id===id);if(!eq)throw new Error('Selecciona al menos un equipo.');if(eq.companyId!==companyId)throw new Error('El equipo pertenece a otra empresa.');return eq;}),base=(form.name||'').trim();return rows.map(eq=>normalizeOperation('workOrders',Object.assign(newOperation('workOrders',companyId),{id:planIds[eq.id]||(planIds[eq.id]=newOperation('workOrders',companyId).id),name:rows.length>1&&base?`${base} · ${eq.tag||eq.name}`:base,type:'Plan de mantenimiento',planState:'Activo',status:'Planificada',customerId:eq.customerId||'',siteId:eq.siteId||'',equipmentId:eq.id,anchorDate:anchor,dueDate:anchor,intervalDays:String(Number(interval)),ownerId:form.ownerId||'',owner:form.owner||'',scope:form.scope||'',reportTemplate:form.reportTemplate||'general'})));}
// Guardas de escritura frente a cambios concurrentes (registro guardado = lo que hay hoy en el almacén local).
// Devuelven 'write' | 'skip' | 'done' ('done' = reintento propio ya aplicado).
export function shouldWriteCancel(stored){if(!stored||stored._sync?.deleted)return 'skip';if(stored.status==='Cancelada'&&(stored.closedReason===CLOSED||stored.closedReason===PLAN_CLOSED))return 'done';return stored.status==='Planificada'&&stored.manualEdit!=='1'?'write':'skip';}
export function shouldWriteCreate(stored,row){if(!stored)return 'write';if(stored._sync?.deleted)return 'skip';if(row.status==='Planificada'&&stored.status==='Planificada')return 'done';return stored.status==='Cancelada'&&stored.closedReason===CLOSED?'write':'skip';}
const PLAN_FIELDS=['name','ownerId','owner','scope','reportTemplate','anchorDate','dueDate','intervalDays','planState'];
// true si el plan guardado cambió (o fue borrado) desde la copia con la que se construyó la edición, salvo que ya contenga los valores buscados.
export function planConflict(stored,snapshot,intended){if(!stored||stored._sync?.deleted)return true;if(stored.updatedAt===snapshot?.updatedAt)return false;return !PLAN_FIELDS.every(k=>(stored[k]??'')===(intended[k]??''));}

// Inicio de visita (puro): plantilla del informe y visita En curso. Si ya hay un informe vigente se reutiliza; si apunta a uno borrado o inexistente, hay que crear otro.
export function startVisit(visit,reports,today){const reportKey=Object.hasOwn(templates,visit.reportTemplate)?visit.reportTemplate:'general',rep=visit.reportId?reports.find(r=>r.id===visit.reportId&&!r._sync?.deleted):null;return {reportKey,reportId:rep?rep.id:'',create:!rep,visit:{...visit,status:'En curso',reportId:rep?rep.id:''}};}

// Calendario mensual (puro). month es 1-12; semanas de lunes a domingo; aritmética en UTC sobre cadenas 'AAAA-MM-DD' (sin zona horaria del dispositivo).
const isoOf=ms=>new Date(ms).toISOString().slice(0,10);
export function shiftMonth(year,month,delta){const i=year*12+(month-1)+delta;return {year:Math.floor(i/12),month:i-Math.floor(i/12)*12+1};}
export function monthGrid(visits,year,month,today,filters={}){const first=Date.UTC(year,month-1,1)/864e5,lead=(new Date(first*864e5).getUTCDay()+6)%7,days=Date.UTC(year,month,1)/864e5-first,rows=Math.ceil((lead+days)/7),f=['ownerId','customerId','equipmentId'].filter(k=>filters[k]),byDay=new Map();
for(const v of visits){if(v.type==='Plan de mantenimiento'||v.status==='Cancelada'||!validIso(v.dueDate)||f.some(k=>v[k]!==filters[k]))continue;(byDay.get(v.dueDate)||byDay.set(v.dueDate,[]).get(v.dueDate)).push(v);}
for(const list of byDay.values())list.sort((a,b)=>(PRIO[a.priority]??4)-(PRIO[b.priority]??4)||String(a.name||'').localeCompare(String(b.name||''),'es',{numeric:true,sensitivity:'base'}));
const weeks=[];for(let r=0;r<rows;r++){const week=[];for(let c=0;c<7;c++){const n=first-lead+r*7+c,date=isoOf(n*864e5);week.push({date,inMonth:n>=first&&n<first+days,isToday:date===today,visits:byDay.get(date)?[...byDay.get(date)]:[]});}weeks.push(week);}
return {year,month,weeks};}
// Tono visual de una visita: vencida (abierta con fecha pasada), en curso, hecha o planificada.
export function visitTone(visit,today){const open=visit.status==='Planificada'||visit.status==='En curso';if(open&&visit.dueDate<today)return 'overdue';if(visit.status==='En curso')return 'progress';if(visit.status==='Completada')return 'done';return 'planned';}

// Carga por técnico (puro). Semanas de lunes a domingo con aritmética UTC sobre cadenas 'AAAA-MM-DD' (sin zona horaria del dispositivo).
const MON=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],NO_OWNER='Sin técnico';
export const mondayOf=iso=>{const n=dayNum(iso);return isoOf((n-(new Date(n*864e5).getUTCDay()+6)%7)*864e5);};
const ownerKey=v=>v.ownerId||String(v.owner||'').trim().toLowerCase();
const ownerName=(v,people)=>{const p=v.ownerId&&people.find(x=>x.id===v.ownerId);return p?.email||String(v.owner||'').trim()||(v.ownerId?'Técnico asignado':NO_OWNER);};
// Una fila de texto libre que coincide con el nombre de una persona con cuenta se rotula «(sin cuenta)» para distinguirlas; quita la marca interna.
function markNoAccount(rows){const named=new Set([...rows.values()].filter(r=>r.account).map(r=>r.name.toLowerCase()));for(const r of rows.values()){if(!r.account&&r.key!==''&&named.has(r.name.toLowerCase()))r.name+=' (sin cuenta)';delete r.account;}}
// Visitas abiertas con fecha válida (sin planes) que pasan los filtros, con su columna: 'overdue' o el índice de semana (omite las que quedan fuera del rango).
function loadEntries(visits,today,filters,weeks){const f=['ownerId','customerId','equipmentId'].filter(k=>filters[k]),start=dayNum(mondayOf(today)),out=[];for(const v of visits){if(v.type==='Plan de mantenimiento'||!['Planificada','En curso'].includes(v.status)||!validIso(v.dueDate)||f.some(k=>v[k]!==filters[k]))continue;const col=v.dueDate<today?'overdue':Math.floor((dayNum(v.dueDate)-start)/7);if(col!=='overdue'&&(col<0||col>=weeks))continue;out.push({v,col,key:ownerKey(v)});}return out;}
export function workloadTable(visits,today,people=[],filters={},weeks=6){const start=dayNum(mondayOf(today)),cols=Array.from({length:weeks},(_,i)=>{const monday=isoOf((start+i*7)*864e5);return {monday,label:`Sem. ${+monday.slice(8)} ${MON[+monday.slice(5,7)-1]}`};}),rows=new Map();
for(const {v,col,key} of loadEntries(visits,today,filters,weeks)){let r=rows.get(key);if(!r){r={key,name:ownerName(v,people),account:!!v.ownerId,overdue:0,cells:Array(weeks).fill(0),total:0};rows.set(key,r);}if(col==='overdue')r.overdue++;else r.cells[col]++;r.total++;}
markNoAccount(rows);
const list=[...rows.values()].sort((a,b)=>(a.key===''?1:0)-(b.key===''?1:0)||a.name.localeCompare(b.name,'es',{numeric:true,sensitivity:'base'}));
return {weeks:cols,rows:list,max:list.reduce((m,r)=>Math.max(m,r.overdue,...r.cells),0)};}
export function workloadCell(visits,today,people,key,col,filters={},weeks=6){return loadEntries(visits,today,filters,weeks).filter(x=>x.key===key&&x.col===col).map(x=>x.v).sort((a,b)=>a.dueDate<b.dueDate?-1:a.dueDate>b.dueDate?1:(PRIO[a.priority]??4)-(PRIO[b.priority]??4)||String(a.name||'').localeCompare(String(b.name||''),'es',{numeric:true,sensitivity:'base'}));}
// Reasigna una visita Planificada: copia con el nuevo responsable y edición manual (protegida del calendario y del plan), o null si no cambia nada.
export function reassignVisit(visit,person){if(visit.status!=='Planificada')return null;const ownerId=person?.ownerId||'',owner=String(person?.owner||'').trim();if((visit.ownerId||'')===ownerId&&(ownerId||String(visit.owner||'').trim()===owner))return null;return {...visit,ownerId,owner,manualEdit:'1'};}
// Responsable escrito a mano (modo local): si el texto no cambió se conserva la cuenta; si cambió, no hay cuenta asociada.
export const OWNER_MAX=200;
export const textPerson=(visit,text)=>{const owner=String(text||'').trim();return {ownerId:owner===String(visit.owner||'').trim()?visit.ownerId||'':'',owner};};
// Datos de un plan para mostrarlo en solo lectura (técnicos).
export function planReadonlyData(plan,visits,equipment,today,people=[]){const asset=equipment.find(x=>x.id===plan.equipmentId),state=plan.planState||'Activo',t=templates[plan.reportTemplate]||templates.general;let history=[];try{const h=JSON.parse(plan.anchorHistory||'[]');if(Array.isArray(h))history=h.filter(x=>x&&x.from&&x.to).map(x=>({from:x.from,to:x.to}));}catch{}
const next=state==='Activo'?visits.filter(v=>v.planId===plan.id&&['Planificada','En curso'].includes(v.status)&&validIso(v.dueDate)&&v.dueDate>=today).map(v=>v.dueDate).sort()[0]||'':'';
return {name:plan.name||'',equipment:asset?(asset.tag?asset.tag+' · ':'')+asset.name:'Equipo no disponible',anchorDate:planAnchor(plan)||'',intervalDays:String(plan.intervalDays||''),owner:people.find(p=>p.id===plan.ownerId)?.email||plan.owner||(plan.ownerId?'Técnico asignado':NO_OWNER),template:t.shortLabel||t.label,scope:plan.scope||'',state,next,history};}

// Indicadores de cumplimiento (puros). Ventana [hoy-(días-1), hoy] por fecha programada, con aritmética entera UTC sobre cadenas 'AAAA-MM-DD'.
const GROUPS=['ownerId','customerId','equipmentId'],byName=(a,b)=>a.localeCompare(b,'es',{numeric:true,sensitivity:'base'}),pct=(a,b)=>b?Math.round(100*a/b):null;
// Fecha de realización: serviceDate del informe vinculado vivo, o '' si no hay o no es una fecha válida.
export function completionDate(visit,reports){const r=visit.reportId&&reports.find(x=>x.id===visit.reportId&&!x._sync?.deleted);return r&&validIso(r.serviceDate)?r.serviceDate:'';}
export const complianceFileName=today=>`planner-indicadores-${today}.csv`;
export function complianceStats(visits,reports,today,days,people=[],filters={},equipment=[]){const ok=validIso(today),span=Number.isInteger(days)&&days>=1?days:90,todayN=ok?dayNum(today):0,from=ok?isoOf((todayN-span+1)*864e5):'',f=GROUPS.filter(k=>filters[k]),eq=new Map(equipment.map(x=>[x.id,(x.tag?x.tag+' · ':'')+x.name])),live=new Map(reports.filter(r=>!r._sync?.deleted).map(r=>[r.id,r]));
const s={from,to:ok?today:'',days:span,measured:0,completed:0,onTime:0,late:0,unknownDate:0,openOverdue:0,oldestOverdueDays:null,compliancePct:null,punctualityPct:null,avgLateDays:null,rows:[],months:[],details:[]},rows=new Map(),months=new Map(),late=[];
if(ok){let y=+from.slice(0,4),m=+from.slice(5,7);const last=today.slice(0,7);for(;;){const ym=`${y}-${String(m).padStart(2,'0')}`;months.set(ym,{ym,label:`${MON[m-1]} ${y}`,measured:0,completed:0,pct:null});if(ym>=last)break;({year:y,month:m}=shiftMonth(y,m,1));}}
for(const v of ok?visits:[]){if(v.type==='Plan de mantenimiento'||!validIso(v.dueDate)||v.dueDate<from||v.dueDate>today||f.some(k=>v[k]!==filters[k]))continue;const finished=v.status==='Completada',open=['Planificada','En curso'].includes(v.status)&&v.dueDate<today;if(!finished&&!open)continue;
const r2=finished&&v.reportId&&live.get(v.reportId),done=finished&&r2&&validIso(r2.serviceDate)?r2.serviceDate:'',key=ownerKey(v);let row=rows.get(key);if(!row){row={key,name:ownerName(v,people),account:!!v.ownerId,measured:0,completed:0,onTime:0,late:0,openOverdue:0,compliancePct:null};rows.set(key,row);}
const mo=months.get(v.dueDate.slice(0,7));let lateDays='';s.measured++;row.measured++;mo.measured++;
if(finished){s.completed++;row.completed++;mo.completed++;if(!done)s.unknownDate++;else if(done<=v.dueDate){s.onTime++;row.onTime++;lateDays=0;}else{s.late++;row.late++;lateDays=dayNum(done)-dayNum(v.dueDate);late.push(lateDays);}}
else{s.openOverdue++;row.openOverdue++;lateDays=todayN-dayNum(v.dueDate);s.oldestOverdueDays=Math.max(s.oldestOverdueDays??0,lateDays);}
s.details.push({dueDate:v.dueDate,doneDate:done,status:finished?'Completada':'Vencida',lateDays,plan:String(v.name||''),equipment:eq.get(v.equipmentId)||'',owner:ownerName(v,people)});}
markNoAccount(rows);
for(const r of rows.values())r.compliancePct=pct(r.completed,r.measured);
s.compliancePct=pct(s.completed,s.measured);s.punctualityPct=pct(s.onTime,s.onTime+s.late);s.avgLateDays=late.length?late.reduce((a,b)=>a+b,0)/late.length:null;
s.rows=[...rows.values()].sort((a,b)=>a.compliancePct-b.compliancePct||byName(a.name,b.name));
s.months=[...months.values()].map(m=>({...m,pct:pct(m.completed,m.measured)}));
s.details.sort((a,b)=>a.dueDate<b.dueDate?-1:a.dueDate>b.dueDate?1:byName(a.plan,b.plan));return s;}
const CSV_HEAD=['Fecha programada','Fecha realizada','Estado','Días de atraso','Plan','Equipo','Técnico'];
const csvCell=x=>{let t=String(x??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return /[;"\r\n]/.test(t)?'"'+t.replaceAll('"','""')+'"':t;};
export function complianceCsv(stats){return '\uFEFF'+[CSV_HEAD,...stats.details.map(d=>[d.dueDate,d.doneDate,d.status,d.lateDays,d.plan,d.equipment,d.owner])].map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n';}
