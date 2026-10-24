import test from 'node:test';
import assert from 'node:assert/strict';
import {newCompany,newReport,uid} from '../public/js/domain.js';
import {changedSinceRead,serializeSaves,independentCopy,mayRefreshReport,mayAdoptSyncMetadata} from '../public/js/drafts.js';
import {memoryIndexedDB} from './helpers/memory-idb.mjs';

test('distingue edición nueva, lectura obsoleta y confirmación del mismo envío',()=>{
 const base={_sync:{version:2,mutationId:'original'}};
 assert.equal(changedSinceRead(base,{_sync:{version:3,mutationId:'original'}}),false);
 assert.equal(changedSinceRead(base,{_sync:{version:2,mutationId:'editado',dirty:true}}),true);
 assert.equal(changedSinceRead({_sync:{version:2}},{_sync:{version:3}}),true);
 assert.equal(changedSinceRead({},base),true);assert.equal(changedSinceRead({},null),false);
});
test('una copia independiente requiere revisión y firmas propias',()=>{
 const company={...newCompany(),name:'Empresa'},r=newReport('automation',company,'AU-1');Object.assign(r,{status:'Emitido',revision:3,parentId:'parent',assignedTo:'old-user',issuedBy:'old-user',approvedBy:'old-user',clientSignature:'firma',technicianSignature:'firma',_sync:{version:9}});
 const result=independentCopy(r,'AU-2');assert.equal(result.status,'Borrador');assert.equal(result.folio,'AU-2');assert.equal(result.revision,0);assert.equal(result.parentId,'');assert.equal(result.approvedBy,'');assert.equal(result.assignedTo,'');assert.equal(result.clientSignature,'');assert.equal(result._sync,undefined);assert.equal(r.status,'Emitido');
});
test('dos conexiones conservan el primer guardado y resguardan el segundo, incluso sin internet',async()=>{
 globalThis.indexedDB=memoryIndexedDB();const a=await import('../public/js/store.js?tabA='+uid()),b=await import('../public/js/store.js?tabB='+uid());
 const company={...newCompany(),name:'Empresa'};await a.saveEntity('companies',company);const r=await a.saveEntity('reports',newReport('hvac',company,'HV-1'));
 const first=await a.get('reports',r.id),second=await b.get('reports',r.id);first.diagnosis='Primera pestaña';second.diagnosis='Segunda pestaña';
 await a.saveEntity('reports',first);let collision;await assert.rejects(b.saveEntity('reports',second),error=>{collision=error;return error.code==='LOCAL_CHANGED'&&!!error.recoveryId;});
 assert.equal((await b.get('reports',r.id)).diagnosis,'Primera pestaña');assert.equal((await b.meta('draftRecovery:'+collision.recoveryId)).data.diagnosis,'Segunda pestaña');
 const [restored,again]=await Promise.all([a.restoreDraftRecovery(collision.recoveryId,'HV-2'),b.restoreDraftRecovery(collision.recoveryId,'HV-3')]);assert.equal(restored.id,again.id);assert.equal(restored.folio,again.folio);assert.equal(restored.status,'Borrador');assert.equal(restored.diagnosis,'Segunda pestaña');assert.equal((await a.all('reports')).length,2);
 // The recovery itself survives a backup and merge into a fresh installation.
 const backup=await a.backup();assert.equal(backup.draftRecoveries.length,1);
 globalThis.indexedDB=memoryIndexedDB();const target=await import('../public/js/store.js?restore='+uid());const plan=await target.previewImport(backup,company);assert.equal(plan.recoveredDrafts,1);await target.importBackup(backup,company);assert.equal((await target.meta('draftRecovery:'+collision.recoveryId)).data.diagnosis,'Segunda pestaña');
 const retry=await target.importBackup(backup,company);assert.equal(retry.recoveredDrafts,0);
});
test('un guardado de catálogo obsoleto no reemplaza el registro de la otra pestaña',async()=>{
 globalThis.indexedDB=memoryIndexedDB();const store=await import('../public/js/store.js?catalog='+uid());const row=await store.saveEntity('companies',{...newCompany(),name:'Inicial'}),stale=structuredClone(row);
 await store.saveEntity('companies',{...row,name:'Actual'});await assert.rejects(store.saveEntity('companies',{...stale,name:'Obsoleto'}),{code:'LOCAL_CHANGED'});assert.equal((await store.get('companies',row.id)).name,'Actual');
});
test('el guardado en cola captura el borrador después de terminar el guardado anterior',async()=>{
 globalThis.indexedDB=memoryIndexedDB();const store=await import('../public/js/store.js?serial='+uid()),company={...newCompany(),name:'Empresa'};
 let live=await store.saveEntity('reports',newReport('general',company,'SER-1')),dirty=true,captured=[];let release,start;const started=new Promise(resolve=>{start=resolve;}),barrier=new Promise(resolve=>{release=resolve;});
 const persist=serializeSaves(async()=>{if(!dirty)return;const snapshot=structuredClone(live);captured.push(snapshot.diagnosis);dirty=false;if(captured.length===1){start();await barrier;}const saved=await store.saveEntity('reports',snapshot);live._sync=saved._sync;});
 live.diagnosis='Edición inicial';const first=persist();await started;live.diagnosis='Edición final';dirty=true;const second=persist();release();await Promise.all([first,second]);
 assert.deepEqual(captured,['Edición inicial','Edición final']);assert.equal((await store.get('reports',live.id)).diagnosis,'Edición final');assert.equal((await store.all('meta')).filter(x=>x.id.startsWith('draftRecovery:')).length,0);
});

test('una descarga remota no adelanta la versión de un formulario con cambios sin guardar',()=>{
 const current={status:'Borrador',_sync:{version:1}},latest={status:'Borrador',_sync:{version:2,dirty:false}};
 assert.equal(mayAdoptSyncMetadata(current,latest),false);assert.equal(mayRefreshReport(current,latest,{dirty:true}),false);assert.equal(mayRefreshReport(current,latest,{pending:true}),false);assert.equal(mayRefreshReport(current,latest),true);
 assert.equal(mayAdoptSyncMetadata({_sync:{version:1,mutationId:'propia'}},{_sync:{version:2,mutationId:'propia'}}),true);
});
