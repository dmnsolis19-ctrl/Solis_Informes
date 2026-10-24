import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeEnvironment} from '../scripts/local-bindings.mjs';
import worker from '../worker/index.js';
import {newCompany,newReport,uid} from '../public/js/domain.js';
import {newCatalog,entityKinds} from '../public/js/catalogs.js';
import {newOperation} from '../public/js/operations.js';

// Replace only the storage/network boundary: run the shipped synchronizer against
// the real Worker and SQL constraints with deterministic browser service doubles.
async function harness(){
 const env=makeEnvironment();
 const request=(path,body,cookie='')=>worker.fetch(new Request('https://solis.test'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Solis-Client':'4',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});
 const setup=await request('/api/setup',{email:'sync@example.test',password:'sync-test-password-123',setupToken:env.SETUP_TOKEN}),cookie=setup.headers.get('Set-Cookie').split(';')[0],user=(await (await request('/api/status',undefined,cookie)).json()).user;
 const data=Object.fromEntries([...entityKinds,'meta'].map(k=>[k,new Map()])),sent=[];
 const storage={async get(k,id){return structuredClone(data[k].get(id));},async all(k){return [...data[k].values()].map(row=>structuredClone(row));},async meta(id,fallback=null){return data.meta.get(id)?.value??fallback;},async setMeta(id,value){data.meta.set(id,{id,value});},async conflicts(){return [];},async acknowledge(kind,id,mutation,version,fields){const row=data[kind].get(id);Object.assign(row,fields);row._sync={...row._sync,version,dirty:row._sync.mutationId!==mutation};},async receive(kind,remote){const prior=data[kind].get(remote.id);assert.ok(!prior?._sync?.dirty,'No remote overwrite of pending changes');data[kind].set(remote.id,{...remote.data,_sync:{version:remote.version,dirty:false,deleted:remote.deleted}});}};
 const key='solisSyncTest'+uid().replaceAll('-',''),context={store:storage,navigator:{onLine:true},setTimeout:()=>0,clearTimeout(){},async fetch(path,options={}){if(context.intercept){const response=await context.intercept(path,options);if(response)return response;}const body=options.body?JSON.parse(options.body):undefined;if(path==='/api/sync/push')sent.push(body.kind);return request(path,body,cookie);},FileReader:class{async readAsDataURL(blob){try{this.result='data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onload();}catch(e){this.error=e;this.onerror();}}}};
 globalThis[key]=context;
 let source=readFileSync(new URL('../public/js/sync.js',import.meta.url),'utf8').replace("import * as store from './store.js';",`const store=globalThis['${key}'].store;`);
 source=source.replace(/from '(\.\/[^']+)'/g,(_,relative)=>`from '${new URL('../public/js/'+relative.slice(2),import.meta.url).href}'`);
 source=`const {navigator,fetch,setTimeout,clearTimeout,FileReader}=globalThis['${key}'];\n`+source;
 const sync=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 sync.syncState.user=user;
 return {env,data,context,sent,sync,put(kind,row){data[kind].set(row.id,{...row,_sync:{version:0,dirty:true,mutationId:uid()}});},close(){env.DB.close();delete globalThis[key];}};
}
test('sincronización completa respeta referencias y deja PDF disponible offline',async()=>{
 const h=await harness();try{const company={...newCompany(),name:'Empresa'},customer={...newCatalog('customers',company.id),name:'Cliente'},report={...newReport('general',company,'SYNC-1'),customerRef:customer.id,customerCompany:'Cliente',site:'Planta',technician:'Ana',objective:'Inspección',scope:'Visual',workPerformed:'Revisión visual.',conclusions:'Condición registrada.',attachments:[{id:uid(),name:'Anexo.pdf',dataUrl:'data:application/pdf;base64,'+btoa('%PDF-1.7\nAnexo de prueba')}]},task={...newOperation('tasks',company.id),name:'Evaluar sello',customerId:customer.id,reportId:report.id};
 for(const [kind,row]of [['tasks',task],['reports',report],['customers',customer],['companies',company]])h.put(kind,row);
 await h.sync.synchronize();assert.equal(h.sync.syncState.status,'synced',h.sync.syncState.message);assert.ok(h.sent.indexOf('reports')<h.sent.indexOf('tasks'));
 const stored=JSON.parse((await h.env.DB.prepare("SELECT data FROM entities WHERE kind='reports'").first()).data);assert.match(stored.attachments[0].dataUrl,/^\/api\/files\//);
 h.data.reports.clear();await h.context.store.setMeta('cursorV4',0);await h.sync.synchronize();assert.match(h.data.reports.get(report.id).attachments[0].dataUrl,/^data:application\/pdf;base64,/);assert.equal(h.data.tasks.get(task.id)._sync.dirty,false);
 }finally{h.close();}
});
test('solicitud offline espera al servidor y se invalida si cambia el contenido',async()=>{
 const h=await harness();try{const company={...newCompany(),name:'Empresa'},r=newReport('general',company,'SYNC-2');h.put('companies',company);h.put('reports',r);h.context.navigator.onLine=false;await h.sync.queueWorkflow(h.data.reports.get(r.id),'En revisión');assert.equal(h.data.reports.get(r.id).status,'Borrador');assert.equal((await h.env.DB.prepare("SELECT COUNT(*) n FROM entities WHERE kind='reports'").first()).n,0);
 h.context.navigator.onLine=true;await h.sync.synchronize();assert.equal(h.sync.syncState.status,'synced',h.sync.syncState.message);assert.equal(h.data.reports.get(r.id).status,'En revisión');assert.equal(await h.context.store.meta('workflow:'+r.id),null);
 const other=newReport('general',company,'SYNC-3');h.put('reports',other);h.context.navigator.onLine=false;await h.sync.queueWorkflow(h.data.reports.get(other.id),'En revisión');h.data.reports.get(other.id)._sync.mutationId=uid();h.context.navigator.onLine=true;await h.sync.synchronize();assert.equal((await h.context.store.meta('workflow:'+other.id)).state,'error');assert.equal(h.sync.syncState.status,'error');assert.equal(h.data.reports.get(other.id).status,'Borrador');
 }finally{h.close();}
});

test('un registro rechazado no bloquea los demás y su error desaparece después de corregirlo',async()=>{
 const h=await harness();try{
  const company={...newCompany(),name:'Empresa'},bad=newReport('general',company,'ERROR-1'),good=newReport('general',company,'OK-1');
  h.put('companies',company);h.put('reports',bad);h.put('reports',good);
  h.context.intercept=(path,options)=>{if(path==='/api/sync/push'&&JSON.parse(options.body).id===bad.id)return new Response(JSON.stringify({error:'Corrige los datos del informe.'}),{status:422});};
  await h.sync.synchronize();assert.equal(h.sync.syncState.status,'error');assert.equal(h.data.reports.get(good.id)._sync.dirty,false);assert.equal(h.data.reports.get(bad.id)._sync.dirty,true);
  assert.equal((await h.context.store.meta('syncIssue:reports:'+bad.id)).message,'Corrige los datos del informe.');
  h.context.intercept=null;await h.sync.synchronize();assert.equal(h.sync.syncState.status,'synced');assert.equal(await h.context.store.meta('syncIssue:reports:'+bad.id),null);assert.equal(h.data.reports.get(bad.id)._sync.dirty,false);
 }finally{h.close();}
});
test('dos solicitudes simultáneas esperan el mismo envío en curso',async()=>{
 const h=await harness();try{
  const company={...newCompany(),name:'Empresa'};h.put('companies',company);
  let release;const barrier=new Promise(resolve=>{release=resolve;});
  h.context.intercept=async(path)=>{if(path==='/api/sync/push')await barrier;};
  const first=h.sync.synchronize(),second=h.sync.synchronize();assert.equal(first,second);
  let completed=false;second.then(()=>{completed=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false);
  release();await second;assert.equal(completed,true);assert.equal(h.sent.filter(kind=>kind==='companies').length,1);assert.equal(h.sync.syncState.status,'synced');
 }finally{h.close();}
});
