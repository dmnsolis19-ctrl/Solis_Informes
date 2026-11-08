import {newOperation} from './operations.js';
import {localDate} from './domain.js';
export const PLANNER_HORIZON_DAYS=90;
const ISO=/^\d{4}-\d{2}-\d{2}$/,dayNum=iso=>Math.round(Date.UTC(+iso.slice(0,4),+iso.slice(5,7)-1,+iso.slice(8,10))/864e5);
const validIso=s=>ISO.test(s||'')&&localDate(new Date(s+'T12:00:00'))===s;
export function addDays(iso,days){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return localDate(d);}
export const visitId=(planId,iso)=>('visit-'+planId+'-'+iso.replaceAll('-','')).slice(0,100);
export const planAnchor=plan=>plan.anchorDate||plan.dueDate;
export function isPlanActive(plan,equipmentIds){return ['','Activo'].includes(plan.planState||'')&&plan.status!=='Cancelada'&&equipmentIds.has(plan.equipmentId)&&/^\d+$/.test(plan.intervalDays||'')&&Number(plan.intervalDays)>=1&&validIso(planAnchor(plan));}
export function newVisit(plan,iso){const v=newOperation('workOrders',plan.companyId);for(const k of ['name','customerId','siteId','equipmentId','owner','ownerId','priority','scope','materials','reportTemplate'])v[k]=plan[k]??v[k];return Object.assign(v,{id:visitId(plan.id,iso),type:'Orden de trabajo',status:'Planificada',planId:plan.id,dueDate:iso});}
// Ventana [hoy, hoy+horizonte] inclusive; nunca fechas pasadas.
export function ensureOccurrences(plan,visits,today,equipmentIds,horizon=PLANNER_HORIZON_DAYS){if(!isPlanActive(plan,equipmentIds))return [];const anchor=planAnchor(plan),n=Number(plan.intervalDays),diff=dayNum(today)-dayNum(anchor),first=diff<=0?anchor:addDays(anchor,Math.ceil(diff/n)*n),last=addDays(today,horizon),have=new Set(visits.filter(v=>v.planId===plan.id).map(v=>v.id)),out=[];for(let d=first;d<=last;d=addDays(d,n)){const id=visitId(plan.id,d);if(!have.has(id))out.push(newVisit(plan,d));}return out;}
const CLOSED='calendario corrido',MAX_HISTORY=50;
// Cancela (copias) las visitas futuras Planificada sin edición manual y devuelve las que faltan según la ancla actual.
// Si una visita a cancelar coincide por id con una fecha nueva, se conserva (no se cancela ni se duplica).
export function regeneratePlan(plan,visits,today,equipmentIds,fromDate=today){const start=fromDate>today?fromDate:today,own=visits.filter(v=>v.planId===plan.id),wanted=new Set(ensureOccurrences(plan,[],start,equipmentIds).map(v=>v.id)),cancel=own.filter(v=>v.status==='Planificada'&&v.manualEdit!=='1'&&v.dueDate>=today&&!wanted.has(v.id)).map(v=>({...v,status:'Cancelada',closedReason:CLOSED})),gone=new Set(cancel.map(v=>v.id)),keep=own.filter(v=>!gone.has(v.id));return {cancel,create:ensureOccurrences(plan,keep,start,equipmentIds)};}
export function closeVisit(plan,visits,visit,doneDate,mode,today,actor,equipmentIds){if(!['keep','shift'].includes(mode))throw new Error('Modo de cierre inválido.');const done={...visit,status:'Completada',notes:[visit.notes,'Realizada el '+doneDate+'.'].filter(Boolean).join('\n')},rest=visits.map(v=>v.id===visit.id?done:v);if(mode==='keep')return {plan,visit:done,cancel:[],create:ensureOccurrences(plan,rest,today,equipmentIds)};let hist=[];try{const h=JSON.parse(plan.anchorHistory||'[]');if(Array.isArray(h))hist=h;}catch{}hist.push({from:visit.dueDate,to:doneDate,by:actor,at:new Date().toISOString(),visitId:visit.id});const next={...plan,anchorDate:doneDate,anchorHistory:JSON.stringify(hist.slice(-MAX_HISTORY))},r=regeneratePlan(next,rest,today,equipmentIds,doneDate);return {plan:next,visit:done,cancel:r.cancel,create:r.create.filter(v=>v.dueDate>doneDate)};}
export const visitsToClose=(visits,reports)=>{const ok=new Set(reports.filter(r=>r.status==='Emitido').map(r=>r.id));return visits.filter(v=>v.status==='En curso'&&v.reportId&&ok.has(v.reportId));};
export const isLate=(visit,report)=>report.serviceDate>visit.dueDate;
