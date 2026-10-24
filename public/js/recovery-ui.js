import {escapeHtml as e,localDate,templates} from './domain.js';
import {pendingChanges} from './recovery.js';
import {syncState} from './sync.js';
let preview = null;
export function clearRecoveryPreview(){preview=null;}
export function recoveryPanel(){return `<section class="panel recovery-panel"><div class="panel-heading"><div><h2>Cambios pendientes de la empresa activa</h2><p>Consulta los registros y las solicitudes que requieren atención.</p></div><button class="btn secondary small" data-action="pending-refresh">Actualizar lista</button></div><label class="field queue-filter"><span>Estado del cambio</span><select id="pending-filter"><option value="">Todos</option>${['Por enviar','Conflicto','Sin permiso','Error de envío','Solicitud pendiente','Solicitud por revisar'].map(label=>`<option>${label}</option>`).join('')}</select></label><div id="pending-changes" aria-live="polite"><p class="muted">Leyendo cambios locales…</p></div></section><section class="panel recovery-panel"><h2>Copias resguardadas</h2><p class="muted">Ediciones conservadas cuando otro cambio se guardó primero. Puedes recuperarlas como un informe nuevo.</p><div id="draft-recoveries"></div></section><section class="panel recovery-panel"><h2>Almacenamiento de este dispositivo</h2><div id="device-storage" aria-live="polite"><p class="muted">Consultando disponibilidad…</p></div><button class="btn secondary small" data-action="persist-storage">Solicitar almacenamiento persistente</button></section>`;}
const bytes=n=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:1}).format(n/1048576)+' MB';
export async function renderRecoveryStatus(ctx){
 const container=document.querySelector('#pending-changes'),storage=document.querySelector('#device-storage');
 if(!container)return;
 const saved=await ctx.db.snapshot();if(!container.isConnected)return;
 const filter=document.querySelector('#pending-filter')?.value||'';
 const reportIndex=new Map(saved.reports.map(report=>[report.id,report]));
 const rows=pendingChanges(saved,syncState.user,saved.meta).filter(row=>row.companyId===ctx.state.companyId);
 for(const {id,value}of saved.meta){if(!id.startsWith('workflow:')||!value)continue;const report=reportIndex.get(value.reportId);if(!report||report._sync?.deleted||report.companyId!==ctx.state.companyId)continue;rows.push({kind:'reports',id:report.id,label:report.folio,type:'Solicitud de estado',status:value.state==='error'?'Solicitud por revisar':'Solicitud pendiente',detail:value.error||`Estado solicitado: ${value.status}`});}
 const visible=rows.filter(row=>!filter||row.status===filter);
 container.innerHTML=`<p class="muted">${visible.length} de ${rows.length} pendientes en esta empresa.</p>${visible.length?`<div class="table-scroll"><table class="ops-table"><thead><tr><th>Registro</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>${visible.slice(0,100).map(row=>`<tr><td><b>${e(row.label)}</b><small class="queue-type">${e(row.type)}</small>${row.kind==='reports'?`<button class="text-btn" data-action="open" data-id="${e(row.id)}">Abrir informe</button>`:''}</td><td><span class="pill ${row.status==='Por enviar'?'neutral':'amber'}">${e(row.status)}</span></td><td>${e(row.detail||'Se enviará al sincronizar con una sesión activa.')}</td></tr>`).join('')}</tbody></table></div>${visible.length>100?'<p class="muted">Mostrando los primeros 100 registros. Usa el filtro para acotar la lista.</p>':''}`:'<p>No hay cambios con este estado.</p>'}`;
 const recoveryList=document.querySelector('#draft-recoveries');if(recoveryList?.isConnected){const list=saved.meta.filter(row=>row.id.startsWith('draftRecovery:')&&row.value?.data?.companyId===ctx.state.companyId);recoveryList.innerHTML=list.map(({value:r})=>`<article class="conflict-card"><b>${e(r.data.folio)} · ${e(r.data.title)}</b><p>${e(new Date(r.at).toLocaleString('es-CL'))}${r.recoveredAs?' · Recuperada como otro informe':''}</p><button class="btn secondary small" data-action="recovery-view" data-id="${e(r.id)}">Revisar copia</button></article>`).join('')||'<p class="muted">No hay copias resguardadas en esta empresa.</p>';}
 if(!storage?.isConnected)return;
 let estimate={},persisted=null;
 try{estimate=await navigator.storage?.estimate?.()||{};persisted=await navigator.storage?.persisted?.()??null;}catch{}
 if(!storage.isConnected)return;
 const last=saved.meta.find(row=>row.id==='backupRequestedAt')?.value;
 const ratio=estimate.quota>0&&Number.isFinite(estimate.usage)?Math.min(100,Math.max(0,estimate.usage/estimate.quota*100)):null;
 storage.innerHTML=`<p>${persisted===true?'Almacenamiento persistente concedido.':persisted===false?'El navegador puede liberar datos si necesita espacio.':'Este navegador no informa la persistencia del almacenamiento.'}</p>${ratio!==null?`<p>${bytes(estimate.usage)} usados de ${bytes(estimate.quota)} estimados para esta dirección.</p><progress class="storage-progress" value="${ratio}" max="100" aria-label="Uso estimado del almacenamiento">${Math.round(ratio)}%</progress>${ratio>=80?'<p class="notice">Queda poco espacio estimado. Descarga un respaldo antes de agregar más fotografías.</p>':''}`:'<p class="muted">Estimación de espacio no disponible.</p>'}<p class="muted">${last?'Última descarga de respaldo solicitada: '+e(new Date(last).toLocaleString('es-CL')):'Aún no se ha solicitado un respaldo desde esta versión.'} Verifica que el archivo esté guardado en tus descargas.</p>`;
}
async function chooseImport(ctx){
 await ctx.persist();
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
 input.onchange=async()=>{try{
  const file=input.files[0];if(!file)return;if(file.size>100000000)throw new Error('El respaldo supera los 100 MB.');
  const data=JSON.parse(await file.text()),plan=await ctx.db.previewImport(data,ctx.company());
  const normalized=plan.normalized;
  const candidate={application:'SOLIS Field',version:4,...normalized.entities,voiceNotes:normalized.voiceNotes,reviewRequests:normalized.reviewRequests,draftRecoveries:normalized.draftRecoveries||[]};
  ctx.modal('Revisar importación',`<p><b>${e(file.name)}</b></p><p>${plan.imported} registros nuevos · ${plan.skipped} existentes conservados · ${plan.deleted} archivados incluidos.</p><div class="table-scroll"><table class="ops-table"><thead><tr><th>Tipo</th><th>Nuevos</th><th>Existentes</th></tr></thead><tbody>${plan.summary.map(row=>`<tr><td>${e(row.label)}</td><td>${row.added}</td><td>${row.kept}</td></tr>`).join('')}</tbody></table></div><p class="muted">${plan.voices} notas de voz · ${plan.reviews} solicitudes de estado. Las notas y solicitudes solo se recuperan para informes nuevos. Las solicitudes recuperadas necesitan revisión antes de enviarse.</p><p>${plan.recoveredDrafts||0} copias resguardadas por recuperar.</p><p class="notice">Los registros existentes se conservarán completos, incluidas sus evidencias. Se comprobará de nuevo el contenido antes de guardar.</p><div class="modal-actions"><button class="btn primary" data-action="import-confirm" ${plan.imported||plan.recoveredDrafts?'':'disabled'}>Importar selección (${plan.imported} registros)</button><button class="btn secondary" data-action="close-modal">Cancelar</button></div>`,{wide:true});
  preview=candidate;
 }catch(error){ctx.toast(error instanceof SyntaxError?'El archivo no contiene un JSON válido.':error.message,true);}};
 input.click();
}
export async function handleRecoveryAction(button,ctx){
 const action=button.dataset.action;
 if(action==='recovery-view'){
  await ctx.persist();const entry=await ctx.db.get('meta','draftRecovery:'+button.dataset.id);if(!entry?.value)throw new Error('La copia ya no está disponible.');
  const r=entry.value.data;if(r.companyId!==ctx.state.companyId)throw new Error('Cambia a la empresa de esta copia para revisarla.');
  const fields=[['Actividades','workPerformed'],['Diagnóstico','diagnosis'],['Observaciones','observations'],['Conclusiones','conclusions'],['Recomendaciones','recommendations']];
  ctx.modal('Copia resguardada · '+r.folio,`<p><b>${e(r.title)}</b> · ${e(r.customerCompany)}</p><p>Esta copia no ha sustituido el informe guardado. Al recuperarla tendrá un folio nuevo, estado Borrador y necesitará su propia revisión y firmas.</p>${fields.filter(([,key])=>r[key]).map(([label,key])=>`<label class="field"><span>${label}</span><textarea readonly rows="4">${e(r[key])}</textarea></label>`).join('')}<p>${r.photos?.length||0} fotografías · ${r.measurements?.length||0} mediciones · ${r.findings?.length||0} hallazgos</p><details><summary>Ver todos los campos de la copia</summary><pre class="recovery-json">${e(JSON.stringify(r,(key,value)=>typeof value==='string'&&value.startsWith('data:')?'[Archivo incluido en la copia]':value,2))}</pre></details><div class="modal-actions"><button class="btn primary" data-action="recovery-copy" data-id="${e(entry.value.id)}">${entry.value.recoveredAs?'Abrir informe recuperado':'Recuperar como informe nuevo'}</button><button class="btn secondary" data-action="close-modal">Cerrar</button></div>`,{wide:true});return true;
 }
 if(action==='recovery-copy'){
  if(button.disabled)return true;button.disabled=true;
  try{await ctx.persist();const entry=await ctx.db.get('meta','draftRecovery:'+button.dataset.id);if(!entry?.value||entry.value.data.companyId!==ctx.state.companyId)throw new Error('La copia no está disponible para esta empresa.');const existing=await ctx.db.get('reports','recovered-'+entry.value.id);const folio=existing?.folio||await ctx.db.nextFolio(templates[entry.value.data.template]?.prefix||'IT');const report=await ctx.db.restoreDraftRecovery(entry.value.id,folio);ctx.closeModal();await ctx.reload();await ctx.openReport(report.id);ctx.toast('Copia recuperada como borrador independiente.');}finally{button.disabled=false;}return true;
 }

 if(action==='backup'){
  button.disabled=true;
  try{await ctx.persist();const data=await ctx.db.backup();ctx.download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`SOLIS_respaldo_${localDate()}.json`);await ctx.db.setMeta('backupRequestedAt',new Date().toISOString()).catch(()=>{});ctx.toast('Respaldo preparado. Verifica el archivo en tus descargas.');await renderRecoveryStatus(ctx);}finally{button.disabled=false;}
  return true;
 }
 if(action==='import'){await chooseImport(ctx);return true;}
 if(action==='import-confirm'){
  if(button.disabled||!preview)return true;button.disabled=true;
  try{await ctx.persist();const result=await ctx.db.importBackup(preview,ctx.company());ctx.closeModal();await ctx.reload();ctx.render();ctx.toast(`${result.imported} registros importados; ${result.skipped} existentes conservados; ${result.recoveredDrafts||0} copias resguardadas.`);}finally{button.disabled=false;}
  return true;
 }
 if(action==='pending-refresh'){await renderRecoveryStatus(ctx);return true;}
 if(action==='persist-storage'){const ok=await navigator.storage?.persist?.();ctx.toast(ok?'Almacenamiento persistente habilitado.':'El navegador no concedió persistencia. Conserva tus respaldos.');await renderRecoveryStatus(ctx);return true;}
 return false;
}
