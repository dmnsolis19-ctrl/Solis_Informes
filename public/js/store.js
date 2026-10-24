import {changedSinceRead,localChangeError,makeDraftRecovery,independentCopy} from './drafts.js';
import {entityKinds} from './catalogs.js';
import {normalizeBackup,planImport} from './recovery.js';
import {uid, normalizeReport, dataForSync, hasChangedDuringSync} from './domain.js';
const DB_NAME='solis-generator-maintenance';let connection;let writeQueue=Promise.resolve();
export function openDb(){if(connection)return connection;connection=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,4);req.onupgradeneeded=()=>{for(const name of [...entityKinds,'meta'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name,{keyPath:'id'});};req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Cierra otras pestañas de SOLIS Field para actualizar el almacenamiento.'));});return connection;}
export async function get(kind,id){const db=await openDb();return new Promise((res,rej)=>{const q=db.transaction(kind).objectStore(kind).get(id);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}
export async function all(kind,{deleted=false}={}){const db=await openDb();return new Promise((res,rej)=>{const q=db.transaction(kind).objectStore(kind).getAll();q.onsuccess=()=>res(q.result.filter(x=>deleted||!x._sync?.deleted));q.onerror=()=>rej(q.error);});}
export async function meta(id,fallback=null){return (await get('meta',id))?.value??fallback;}
export async function setMeta(id,value){const db=await openDb();await new Promise((res,rej)=>{const tx=db.transaction('meta','readwrite');tx.objectStore('meta').put({id,value});tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error);});}
function queued(fn){const p=writeQueue.then(fn);writeQueue=p.catch(()=>{});return p;}
export function saveEntity(kind,input,{deleted=false,allowIssued=false}={}){return queued(async()=>{
 const db=await openDb(),row=structuredClone(input);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([kind,'meta'],'readwrite'),records=tx.objectStore(kind),request=records.get(row.id);let out,failure;
  request.onsuccess=()=>{
   const prior=request.result;
   if(changedSinceRead(row,prior)){
    let recovery=null;if(kind==='reports'){recovery=makeDraftRecovery(row);tx.objectStore('meta').put({id:'draftRecovery:'+recovery.id,value:recovery});}
    failure=localChangeError(recovery?.id);return;
   }
   if(kind==='reports'&&prior?.status==='Emitido'&&!allowIssued){failure=new Error('Un informe emitido no se puede modificar. Crea una revisión.');tx.abort();return;}
   out={...row,updatedAt:new Date().toISOString(),_sync:{...prior?._sync,version:prior?._sync?.version||0,dirty:true,deleted,mutationId:uid(),conflict:prior?._sync?.conflict||false}};records.put(out);
  };
  tx.oncomplete=()=>failure?reject(failure):resolve(out);tx.onabort=()=>reject(failure||tx.error);tx.onerror=()=>reject(tx.error);
 });
});}
export function updateDraftRecovery(id,report){return queued(async()=>{const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite'),records=tx.objectStore('meta'),request=records.get('draftRecovery:'+id);request.onsuccess=()=>{if(request.result){const prior=request.result;prior.value={...prior.value,data:dataForSync(report)};records.put(prior);}};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});});}
export function restoreDraftRecovery(id,folio){return queued(async()=>{const db=await openDb();return new Promise((resolve,reject)=>{
 const tx=db.transaction(['reports','meta'],'readwrite'),metaStore=tx.objectStore('meta'),reports=tx.objectStore('reports'),request=metaStore.get('draftRecovery:'+id);let result,failure;
 request.onsuccess=()=>{const entry=request.result;if(!entry?.value){failure=new Error('La copia resguardada ya no está disponible.');tx.abort();return;}const copyId='recovered-'+id,prior=reports.get(copyId);prior.onsuccess=()=>{if(prior.result){if(entry.value.recoveredAs!==copyId||prior.result.companyId!==entry.value.data.companyId){failure=new Error('El identificador de recuperación pertenece a otro informe. No se modificó ningún registro.');tx.abort();return;}result=prior.result;return;}result=independentCopy(entry.value.data,folio);result.id=copyId;result._sync={version:0,dirty:true,deleted:false,mutationId:uid(),conflict:false};reports.put(result);entry.value.recoveredAs=copyId;metaStore.put(entry);};};
 tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||tx.error);tx.onerror=()=>reject(tx.error);
});});}
export async function nextFolio(prefix){const db=await openDb();let device=await meta('device');if(!device){device=uid().replaceAll('-','').slice(0,6).toUpperCase();await setMeta('device',device);}const year=new Date().getFullYear();const key=`sequence:${prefix}:${year}`;const number=await new Promise((res,rej)=>{const tx=db.transaction('meta','readwrite'),s=tx.objectStore('meta'),q=s.get(key);let n;q.onsuccess=()=>{n=(q.result?.value||0)+1;s.put({id:key,value:n});};tx.oncomplete=()=>res(n);tx.onabort=()=>rej(tx.error);});return `${prefix}-${year}-${String(number).padStart(4,'0')}-${device}`;}
export async function migrateLegacy(company){for(const row of await all('reports',{deleted:true})){if(!row.schemaVersion||!row._sync){const normalized=normalizeReport(row,company);await saveEntity('reports',normalized,{allowIssued:true});if(row.id!==normalized.id){const db=await openDb();await new Promise((res,rej)=>{const tx=db.transaction('reports','readwrite');tx.objectStore('reports').delete(row.id);tx.oncomplete=res;tx.onabort=()=>rej(tx.error);});}}}}
export async function acknowledge(kind,id,mutationId,remoteVersion,serverFields={}){return queued(async()=>{const db=await openDb();await new Promise((res,rej)=>{const tx=db.transaction(kind,'readwrite'),s=tx.objectStore(kind),q=s.get(id);q.onsuccess=()=>{const row=q.result;if(!row)return;Object.assign(row,serverFields);row._sync={...row._sync,version:remoteVersion,dirty:hasChangedDuringSync(row,mutationId),conflict:false};s.put(row);};tx.oncomplete=res;tx.onabort=()=>rej(tx.error);});});}
export async function receive(kind,remote){return queued(async()=>{const db=await openDb();await new Promise((res,rej)=>{const tx=db.transaction([kind,'meta'],'readwrite'),s=tx.objectStore(kind),q=s.get(remote.id);q.onsuccess=()=>{const local=q.result;if(local?._sync?.dirty){if((local._sync.version||0)!==remote.version){local._sync.conflict=true;s.put(local);tx.objectStore('meta').put({id:`conflict:${kind}:${remote.id}`,value:remote});}return;}s.put({...remote.data,id:remote.id,_sync:{version:remote.version,dirty:false,deleted:remote.deleted,conflict:false}});};tx.oncomplete=res;tx.onabort=()=>rej(tx.error);});});}
export async function conflicts(){return (await all('meta')).filter(r=>r.id.startsWith('conflict:'));}
export async function resolveConflict(key,choice){const entry=await get('meta',key);if(!entry)return;const [,kind,id]=key.split(':');const remote=entry.value;const local=await get(kind,id);const db=await openDb();await new Promise((res,rej)=>{const tx=db.transaction([kind,'meta'],'readwrite');if(choice==='remote')tx.objectStore(kind).put({...remote.data,id,_sync:{version:remote.version,dirty:false,deleted:remote.deleted,conflict:false}});else {local._sync={...local._sync,version:remote.version,dirty:true,mutationId:uid(),conflict:false};tx.objectStore(kind).put(local);}tx.objectStore('meta').delete(key);tx.oncomplete=res;tx.onabort=()=>rej(tx.error);});}
// All stores are read in one transaction so a backup cannot mix different moments.
export function snapshot(){return queued(async()=>{const db=await openDb();return new Promise((resolve,reject)=>{const names=[...entityKinds,'meta'],tx=db.transaction(names),out={};for(const kind of names){const request=tx.objectStore(kind).getAll();request.onsuccess=()=>{out[kind]=request.result;};}tx.oncomplete=()=>resolve(out);tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});});}
export async function backup(){
 const saved=await snapshot(),out={application:'SOLIS Field',version:4,exportedAt:new Date().toISOString()};
 for(const kind of entityKinds)out[kind]=saved[kind].map(row=>({...dataForSync(row),_backupDeleted:!!row._sync?.deleted}));
 out.voiceNotes=saved.meta.filter(row=>row.id.startsWith('voice:')&&row.value).map(row=>({reportId:row.id.slice(6),...row.value}));
 out.draftRecoveries=saved.meta.filter(row=>row.id.startsWith('draftRecovery:')&&row.value).map(row=>row.value);
 out.reviewRequests=saved.meta.filter(row=>row.id.startsWith('workflow:')&&row.value).map(({value:v})=>({reportId:v.reportId,status:v.status,action:v.action,reason:v.reason||'',at:v.at||''}));
 return out;
}
export async function previewImport(value,company){const normalized=normalizeBackup(value,company),current=await snapshot();return {normalized,...planImport(normalized,current)};}
export function importBackup(value,company){
 const prepared=normalizeBackup(value,company);
 return queued(async()=>{const db=await openDb();return new Promise((resolve,reject)=>{
  const tx=db.transaction([...entityKinds,'meta'],'readwrite'),current={};let remaining=entityKinds.length+1,result,failure;
  for(const kind of [...entityKinds,'meta']){const request=tx.objectStore(kind).getAll();request.onsuccess=()=>{current[kind]=request.result;if(--remaining===0)write();};}
  function write(){try{
   result=planImport(prepared,current);
   const addedReports=new Set();
   for(const kind of entityKinds){const existing=new Set(current[kind].map(row=>row.id));for(const row of prepared.entities[kind]){if(existing.has(row.id))continue;const {_backupDeleted,...data}=row;tx.objectStore(kind).put({...data,_sync:{version:0,dirty:true,deleted:_backupDeleted,mutationId:uid()}});if(kind==='reports')addedReports.add(row.id);}}
   for(const voice of prepared.voiceNotes){if(!addedReports.has(voice.reportId))continue;tx.objectStore('meta').put({id:'voice:'+voice.reportId,value:{audio:voice.audio,text:voice.text||'',at:voice.at||''}});}
   const savedRecoveries=new Set(current.meta.map(row=>row.id));for(const recovery of prepared.draftRecoveries){const key='draftRecovery:'+recovery.id;if(!savedRecoveries.has(key))tx.objectStore('meta').put({id:key,value:recovery});}
   // Imported requests are context for the reviewer, never authorization to send.
   for(const request of prepared.reviewRequests){if(!addedReports.has(request.reportId))continue;tx.objectStore('meta').put({id:'workflow:'+request.reportId,value:{...request,state:'error',error:'Solicitud recuperada de un respaldo. Revisa el informe y vuelve a solicitar el estado.',mutationId:'',requestId:uid()}});}
  }catch(error){failure=error;tx.abort();}}
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||tx.error||new Error('No se pudo importar el respaldo.'));tx.onerror=()=>reject(tx.error);
 });});
}
