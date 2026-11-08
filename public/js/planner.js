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
// Ventana de 90 días contada desde la primera ocurrencia >= hoy (inclusive); nunca fechas pasadas.
export function ensureOccurrences(plan,visits,today,equipmentIds,horizon=PLANNER_HORIZON_DAYS){if(!isPlanActive(plan,equipmentIds))return [];const anchor=planAnchor(plan),n=Number(plan.intervalDays),diff=dayNum(today)-dayNum(anchor),first=diff<=0?anchor:addDays(anchor,Math.ceil(diff/n)*n),last=addDays(first,horizon),have=new Set(visits.filter(v=>v.planId===plan.id).map(v=>v.id)),out=[];for(let d=first;d<=last;d=addDays(d,n)){const id=visitId(plan.id,d);if(!have.has(id))out.push(newVisit(plan,d));}return out;}
