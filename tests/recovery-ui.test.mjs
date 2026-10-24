import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRecoveryAction,clearRecoveryPreview,renderRecoveryStatus} from '../public/js/recovery-ui.js';
import {syncState} from '../public/js/sync.js';
import {newCompany,newReport} from '../public/js/domain.js';
import {entityKinds} from '../public/js/catalogs.js';

const company={...newCompany(),name:'Empresa'},report=newReport('general',company,'PREVIEW-1');
test('descargar respaldo espera el guardado del borrador más reciente',async()=>{
 let downloaded;const calls=[],button={dataset:{action:'backup'},disabled:false};let text='Anterior';
 globalThis.document={querySelector:()=>null};
 const ctx={async persist(){await Promise.resolve();text='Última edición';calls.push('save');},db:{async backup(){calls.push('backup');return {text};},async setMeta(){calls.push('metadata');}},download(blob){downloaded=blob;calls.push('download');},toast(){}};
 await handleRecoveryAction(button,ctx);assert.deepEqual(calls,['save','backup','download','metadata']);assert.equal(JSON.parse(await downloaded.text()).text,'Última edición');assert.equal(button.disabled,false);
});
test('una importación espera la confirmación de la vista previa y conserva los IDs normalizados',async()=>{
 const input={files:[{name:'<respaldo>.json',size:42,async text(){return '{}';}}],click(){}};let imported=0,body='';
 globalThis.document={createElement:()=>input};
 const ctx={async persist(){},company:()=>company,db:{async previewImport(){return {normalized:{entities:{companies:[company],reports:[report]},voiceNotes:[],reviewRequests:[]},imported:2,skipped:0,deleted:0,summary:[{label:'Informes',added:1,kept:0}],voices:0,reviews:0};},async importBackup(value){imported++;assert.equal(value.reports[0].id,report.id);return {imported:2,skipped:0};}},modal(title,html){body=html;},closeModal(){clearRecoveryPreview();},async reload(){},render(){},toast(){}};
 await handleRecoveryAction({dataset:{action:'import'}},ctx);await input.onchange();assert.equal(imported,0);assert.match(body,/&lt;respaldo&gt;/);assert.match(body,/Importar selección \(2 registros\)/);
 await handleRecoveryAction({dataset:{action:'import-confirm'}},ctx);assert.equal(imported,1);
 await handleRecoveryAction({dataset:{action:'import-confirm'}},ctx);assert.equal(imported,1);
});
test('la lista de pendientes muestra solo la empresa activa y escapa los errores',async()=>{
 const target={isConnected:true,innerHTML:''};globalThis.document={querySelector:key=>key==='#pending-changes'?target:null};syncState.user=null;
 const saved=Object.fromEntries(entityKinds.map(kind=>[kind,[]]));saved.reports=[{...report,_sync:{dirty:true}},{...report,id:'other',companyId:'otra',_sync:{dirty:true}}];saved.meta=[{id:'syncIssue:reports:'+report.id,value:{message:'<script>error</script>'}}];
 await renderRecoveryStatus({state:{companyId:company.id},db:{async snapshot(){return saved;}}});assert.match(target.innerHTML,/1 de 1 pendientes/);assert.match(target.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(target.innerHTML,/<script>/);
});

test('no recupera una copia desde una empresa activa diferente',async()=>{
 let writes=0;const ctx={state:{companyId:'otra-empresa'},async persist(){},db:{async get(){return {value:{id:'recovery',data:report}};},async restoreDraftRecovery(){writes++;}}};
 await assert.rejects(handleRecoveryAction({dataset:{action:'recovery-copy',id:'recovery'}},ctx),/esta empresa/);assert.equal(writes,0);
});
