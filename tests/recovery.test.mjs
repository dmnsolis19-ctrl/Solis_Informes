import test from 'node:test';
import assert from 'node:assert/strict';
import {newCompany,newReport,uid} from '../public/js/domain.js';
import {newCatalog,entityKinds} from '../public/js/catalogs.js';
import {normalizeBackup,planImport,pendingChanges} from '../public/js/recovery.js';
import {memoryIndexedDB} from './helpers/memory-idb.mjs';
const company={...newCompany(),name:'Empresa de prueba'};
const base=()=>({application:'SOLIS Field',version:4,companies:[company],reports:[newReport('general',company,'REC-001')]});
const empty=()=>Object.fromEntries(entityKinds.map(kind=>[kind,[]]));

test('respaldo antiguo se normaliza y conserva informes archivados',()=>{
 const value=base();delete value.application;delete value.version;value.reports[0]._backupDeleted=true;
 const result=normalizeBackup(value,company),plan=planImport(result,empty());
 assert.equal(result.entities.reports[0]._backupDeleted,true);assert.equal(plan.imported,2);assert.equal(plan.deleted,1);
});
test('rechaza versión futura, listas corruptas e identificadores duplicados antes de importar',()=>{
 const future=base();future.version=5;assert.throws(()=>normalizeBackup(future,company),/Versión/);
 const bad=base();bad.equipment={};assert.throws(()=>normalizeBackup(bad,company),/Lista/);
 const duplicate=base();duplicate.reports.push(structuredClone(duplicate.reports[0]));assert.throws(()=>normalizeBackup(duplicate,company),/duplicado/);
 const corrupt=base();corrupt.reports[0].attachments={};assert.throws(()=>normalizeBackup(corrupt,company),/informe inválido/);
});
test('vista previa combina referencias existentes y evita referencias de otra empresa',()=>{
 const value=base(),customer={...newCatalog('customers',company.id),name:'Cliente'};value.reports[0].customerRef=customer.id;
 const prepared=normalizeBackup(value,company);assert.throws(()=>planImport(prepared,empty()),/referencia/);
 const current=empty();current.customers=[customer];assert.equal(planImport(prepared,current).imported,2);
 current.customers[0]={...customer,companyId:'otra-empresa'};assert.throws(()=>planImport(prepared,current),/referencia/);
});
test('rechaza folio y revisión duplicados con IDs diferentes',()=>{
 const value=base(),current=empty();current.reports=[{...value.reports[0],id:uid()}];
 assert.throws(()=>planImport(normalizeBackup(value,company),current),/folio/);
});
test('no confunde DNI de contacto de informes antiguos con una ficha del directorio',()=>{
 const value=base();value.reports[0].customerId='12345678';assert.equal(planImport(normalizeBackup(value,company),empty()).imported,2);
});
test('una fila existente se conserva aun cuando el respaldo tiene referencias antiguas',()=>{
 const value=base(),current=empty();current.companies=[company];current.reports=[structuredClone(value.reports[0])];value.reports[0].customerRef='cliente-antiguo';
 const plan=planImport(normalizeBackup(value,company),current);assert.equal(plan.skipped,2);assert.equal(plan.imported,0);
});
test('la cola distingue conflictos, permisos y errores de envío, sin mostrar filas limpias',()=>{
 const values=empty(),row=newReport('general',company,'Q-001');values.reports=[{...row,_sync:{dirty:true}},{...row,id:'conflict',_sync:{dirty:true,conflict:true}},{...row,id:'clean',_sync:{dirty:false}}];values.companies=[{...company,_sync:{dirty:true}}];
 const user={role:'technician',companyIds:[company.id]};
 const rows=pendingChanges(values,user,[{id:'syncIssue:reports:'+row.id,value:{message:'Completa el objetivo'}}]);
 assert.equal(rows.length,3);assert.equal(rows.find(r=>r.id===row.id).status,'Error de envío');assert.equal(rows.find(r=>r.id===company.id).status,'Sin permiso');assert.equal(rows.find(r=>r.id==='conflict').status,'Conflicto');
});

test('respaldo e importación usan transacciones, conservan existentes y recuperan solicitudes sin enviarlas',async()=>{
 const indexedDB=memoryIndexedDB();globalThis.indexedDB=indexedDB;
 const store=await import('../public/js/store.js?recovery='+uid());
 const value=base(),r=value.reports[0];value.reports[0]._backupDeleted=true;value.reviewRequests=[{reportId:r.id,status:'En revisión',action:'transition',reason:''}];value.voiceNotes=[{reportId:r.id,audio:'data:audio/webm;base64,YQ==',text:'Nota original'}];
 const result=await store.importBackup(value,company);assert.equal(result.imported,2);
 assert.equal((await store.get('reports',r.id))._sync.deleted,true);
 const request=await store.meta('workflow:'+r.id);assert.equal(request.state,'error');assert.match(request.error,/respaldo/);
 await store.setMeta('principal','no-exportar');await store.setMeta('voice:'+r.id,{audio:'data:audio/webm;base64,Yg==',text:'Nota local'});
 const retry=await store.importBackup(value,company);assert.equal(retry.skipped,2);assert.equal((await store.meta('voice:'+r.id)).text,'Nota local');
 const output=await store.backup();assert.equal(output.reports[0]._backupDeleted,true);assert.equal(output.reviewRequests.length,1);assert.ok(!JSON.stringify(output).includes('no-exportar'));
 assert.deepEqual(indexedDB.history.at(-1).names,[...entityKinds,'meta']);assert.equal(indexedDB.history.at(-1).mode,'readonly');
 // A failed write must roll back the entire import, including the first row.
 const otherCompany={...newCompany(),name:'Empresa nueva'},other=newReport('general',otherCompany,'ROLLBACK-1');indexedDB.failWritesTo(other.id);
 await assert.rejects(store.importBackup({companies:[otherCompany],reports:[other]},company),/QuotaExceeded/);
 assert.equal(await store.get('companies',otherCompany.id),undefined);assert.equal(await store.get('reports',other.id),undefined);
 indexedDB.failWritesTo(null);
 // Preview is informational; validation repeats inside the write transaction.
 const third=newReport('general',company,'RACE-1'),incoming={companies:[company],reports:[third]};await store.previewImport(incoming,company);
 await store.saveEntity('reports',{...third,id:uid()});await assert.rejects(store.importBackup(incoming,company),/folio/);assert.equal(await store.get('reports',third.id),undefined);
});

test('rechaza empresa malformada y recupera la marca correcta cuando falta la copia histórica',()=>{
 const invalid=base();invalid.companies[0]={...company,tradeName:{}};assert.throws(()=>normalizeBackup(invalid,company),/empresa inválido/);
 const value=base();value.reports[0].companySnapshot=null;const other={...newCompany(),name:'Otra empresa'};
 assert.equal(normalizeBackup(value,other).entities.reports[0].companySnapshot.id,company.id);
});
test('comprueba TAG único y relación entre cliente e instalación antes de escribir',()=>{
 const value=base(),customer={...newCatalog('customers',company.id),name:'Cliente'},site={...newCatalog('sites',company.id),name:'Planta',customerId:customer.id},asset={...newCatalog('equipment',company.id),name:'Bomba',tag:'B-1',customerId:customer.id,siteId:site.id};
 value.customers=[customer];value.sites=[site];value.equipment=[asset];const current=empty();current.equipment=[{...asset,id:uid(),tag:'b-1'}];
 assert.throws(()=>planImport(normalizeBackup(value,company),current),/TAG/);
 current.equipment=[];value.customers.push({...customer,id:'other-customer'});value.equipment[0].customerId='other-customer';
 assert.throws(()=>planImport(normalizeBackup(value,company),current),/instalación no pertenece/);
});
