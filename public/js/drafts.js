import {uid,dataForSync} from './domain.js';
export function changedSinceRead(input,prior){
 if(!prior)return false;
 if(!input._sync)return !!prior._sync;
 const old=input._sync,current=prior._sync||{};
 const sameMutation=!!old.mutationId&&old.mutationId===current.mutationId;
 return (old.mutationId||null)!==(current.mutationId||null)||(!sameMutation&&(old.version||0)!==(current.version||0));
}
export function localChangeError(recoveryId=null){const error=new Error(recoveryId?'Otro cambio se guardó primero. Tu edición quedó en Copias resguardadas.':'Este registro cambió desde que lo abriste. Abre la versión actual antes de guardar.');error.code='LOCAL_CHANGED';error.recoveryId=recoveryId;return error;}
export function makeDraftRecovery(row){return {id:uid(),recordId:row.id,at:new Date().toISOString(),data:dataForSync(row)};}
export function serializeSaves(task){let queue=Promise.resolve();return ()=>{const next=queue.catch(()=>{}).then(task);queue=next;return next;};}
export function independentCopy(report,folio){
 const copy=dataForSync(report);copy.id=uid();copy.folio=folio;copy.revision=0;copy.parentId='';copy.status='Borrador';copy.legacyImported=false;copy.schemaVersion=4;copy.clientSignature=copy.technicianSignature='';
 for(const key of ['createdBy','assignedTo','approvedBy','approvedAt','reviewedBy','reviewedAt','issuedBy','issuedAt'])copy[key]='';
 copy.createdAt=copy.updatedAt=new Date().toISOString();copy.history=[{at:copy.createdAt,action:'Nuevo borrador creado desde una copia resguardada',by:''}];return copy;
}

export function mayRefreshReport(current,latest,{dirty=false,pending=false}={}){return !dirty&&!pending&&!!latest&&!latest._sync?.dirty&&(latest.status!==current.status||(latest._sync?.version||0)!==(current._sync?.version||0));}
export function mayAdoptSyncMetadata(current,latest){return !!current._sync?.mutationId&&current._sync.mutationId===latest?._sync?.mutationId;}
