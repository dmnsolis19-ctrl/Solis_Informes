import * as store from './store.js';
import {dataForSync} from './domain.js';
export const syncState={status:'local',message:'Guardado en este dispositivo',configured:false,user:null,capabilities:{},lastSync:null};
let running=false,timer,notify=()=>{},failures=0;const uploadedAssets=new Map();
export function subscribeSync(fn){notify=fn;}
function update(values){Object.assign(syncState,values);notify(syncState);}
export async function api(path,body,method=body===undefined?'GET':'POST'){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
 try {const res=await fetch(path,{method,credentials:'same-origin',headers:{'X-Solis-Client':'2',...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});let value;try{value=await res.json();}catch{throw new Error('El servidor no devolvió una respuesta válida.');}if(!res.ok){const error=new Error(value.error||`Error ${res.status}`);error.status=res.status;error.payload=value;throw error;}return value;}finally{clearTimeout(timeout);}
}
export async function checkSession(){try {const info=await api('/api/status');update({configured:info.configured,capabilities:info.capabilities||{},user:info.user||null,status:!navigator.onLine?'offline':info.user?'ready':info.configured?'login':'local',message:!navigator.onLine?'Sin conexión · guardado local':info.user?'Listo para sincronizar':info.configured?'Inicia sesión para sincronizar':'Modo local · servidor sin configurar'});return info;}catch{update({status:'offline',message:'Sin conexión al servidor · guardado local'});}}
export async function login(email,password,setupToken=''){const value=await api(setupToken?'/api/setup':'/api/login',{email,password,setupToken});await checkSession();return value;}
export async function logout(){await api('/api/logout',{});update({user:null,status:'login',message:'Sesión cerrada · datos locales conservados'});}
export async function hydrate(value){if(typeof value==='string'&&/^\/api\/assets\/[a-f0-9]{64}$/.test(value)){const res=await fetch(value,{credentials:'same-origin',cache:'no-store'});if(!res.ok)throw new Error('No se pudo descargar una evidencia. Se reintentará al sincronizar.');const blob=await res.blob();return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}if(Array.isArray(value))return Promise.all(value.map(hydrate));if(value&&typeof value==='object'){const out={};for(const [k,v]of Object.entries(value))out[k]=await hydrate(v);return out;}return value;}
export async function uploadAssets(value){if(typeof value==='string'&&value.startsWith('data:image/')){const key=syncState.user.workspaceId+'|'+value;if(uploadedAssets.has(key))return uploadedAssets.get(key);const result=await api('/api/assets',{dataUrl:value});uploadedAssets.set(key,result.ref);return result.ref;}if(Array.isArray(value)){const out=[];for(const v of value)out.push(await uploadAssets(v));return out;}if(value&&typeof value==='object'){const out={};for(const [k,v]of Object.entries(value))out[k]=await uploadAssets(v);return out;}return value;}
export async function synchronize(){
 if(running||!navigator.onLine)return;
 running=true;
 try{
  if(!syncState.user)await checkSession();
  if(!syncState.user)return;
  const workspace=syncState.user.workspaceId,prior=await store.meta('workspace');
  if(prior&&prior!==workspace){update({status:'blocked',message:'Esta cuenta pertenece a otro espacio. Exporta tus datos y usa otro perfil del navegador.'});return;}
  if(!prior)await store.setMeta('workspace',workspace);
  update({status:'syncing',message:'Sincronizando cambios…'});
  let conflicted=false;
  for(const kind of ['companies','reports'])for(const row of (await store.all(kind,{deleted:true})).sort((a,b)=>(a.revision||0)-(b.revision||0)||a.createdAt?.localeCompare(b.createdAt||'')||0)){
   if(!row._sync?.dirty||row._sync.conflict)continue;
   const sent=row._sync.mutationId;
   try{const result=await api('/api/sync/push',{kind,id:row.id,baseVersion:row._sync.version||0,mutationId:sent,deleted:!!row._sync.deleted,data:await uploadAssets(dataForSync(row))});await store.acknowledge(kind,row.id,sent,result.version);}
   catch(error){if(error.status===409&&error.payload?.remote){const remote=error.payload.remote;remote.data=await hydrate(remote.data);await store.receive(kind,remote);conflicted=true;}else throw error;}
  }
  let cursor=await store.meta('cursor',0),more=true;
  while(more){const result=await api(`/api/sync/pull?since=${cursor}`);for(const item of result.items){const local=await store.get(item.kind,item.id);if(local&&local._sync?.version===item.version)continue;item.data=await hydrate(item.data);await store.receive(item.kind,item);}cursor=result.cursor;await store.setMeta('cursor',cursor);more=result.more;}
  const conflicts=await store.conflicts();conflicted ||= conflicts.length>0;
  const at=new Date().toISOString();await store.setMeta('lastSync',at);failures=0;update({status:conflicted?'conflict':'synced',message:conflicted?'Hay cambios que necesitan revisión':'Cambios sincronizados',lastSync:at});
 }catch(error){failures++;if(error.status===401)update({status:'login',user:null,message:'Tu sesión venció. Inicia sesión para sincronizar.'});else update({status:'error',message:error.message||'No se pudo sincronizar. Tus datos siguen guardados localmente.'});}
 finally{running=false;clearTimeout(timer);timer=setTimeout(synchronize,Math.min(300000,30000*2**Math.min(failures,3)));}
}
export function startSync(){window.addEventListener('online',()=>{checkSession().then(synchronize);});window.addEventListener('offline',()=>update({status:'offline',message:'Sin conexión · guardado local'}));window.addEventListener('focus',()=>synchronize());document.addEventListener('visibilitychange',()=>{if(!document.hidden)synchronize();});checkSession().then(synchronize);}
