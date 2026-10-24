import {entityKinds, normalizeCatalog, validateTemplateSnapshot} from './catalogs.js';
import {normalizeReport, dataForSync, newCompany, safeImage} from './domain.js';

export const entityLabels = {companies:'Empresas',customers:'Clientes',sites:'Instalaciones',equipment:'Equipos',reportTemplates:'Plantillas',reports:'Informes',tasks:'Acciones',workOrders:'Órdenes y planes',manuals:'Manuales',alertRules:'Reglas de alertas'};
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const listFields = ['photos','checklist','measurements','assets','actions','proposalItems','history','findings','customSections','attachments','sourceReferences'];

export function normalizeBackup(value, company) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.reports)) throw new Error('El respaldo no contiene una lista válida de informes.');
 if (value.version !== undefined && (!Number.isInteger(value.version) || value.version < 1 || value.version > 4)) throw new Error('Versión de respaldo no compatible. Abre el archivo con una versión actualizada de SOLIS.');
 if (value.application !== undefined && value.application !== 'SOLIS Field') throw new Error('El archivo no es un respaldo de SOLIS Field.');
 const entities = {};
 for (const kind of entityKinds) {
  const rows = value[kind] === undefined ? [] : value[kind];
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error(`Lista inválida o demasiado extensa: ${entityLabels[kind]}.`);
  const ids = new Set();
  entities[kind] = rows.map(raw => {
   if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Registro inválido: ${entityLabels[kind]}.`);
   let row;
   if (kind === 'reports') {
    if (typeof raw.folio !== 'string' || listFields.some(key => raw[key] !== undefined && !Array.isArray(raw[key]))) throw new Error('Hay un informe inválido en el respaldo.');
    if (raw.schemaVersion > 4) throw new Error('Un informe requiere una versión más reciente de SOLIS.');
    row = normalizeReport(raw, entities.companies.find(item=>item.id===raw.companyId) || company);
    if (row.templateSnapshot) row.templateSnapshot = validateTemplateSnapshot(row.templateSnapshot);
    if (!validId(row.companyId)) throw new Error('Empresa del informe inválida.');
   } else if (kind === 'companies') {
    if (!validId(raw.id) || typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('Empresa inválida.');
    row = {...newCompany(),...structuredClone(raw)};
    for(const key of Object.keys(newCompany()))if(typeof row[key] !== 'string' || row[key].length > (key === 'logo' ? 1000000 : key === 'footer' ? 2000 : 500))throw new Error('Campo de empresa inválido: '+key);
    if(row.logo&&!safeImage(row.logo))throw new Error('Logo de empresa inválido.');
   } else row = normalizeCatalog(kind, raw);
   if (!validId(row.id) || ids.has(row.id)) throw new Error(`Identificador inválido o duplicado: ${entityLabels[kind]}.`);
   ids.add(row.id);
   return {...dataForSync(row), _backupDeleted:raw._backupDeleted === true};
  });
 }
 const reports = new Set(entities.reports.map(row => row.id));
 const voiceNotes = value.voiceNotes === undefined ? [] : value.voiceNotes, reviewRequests = value.reviewRequests === undefined ? [] : value.reviewRequests;
 if (!Array.isArray(voiceNotes) || voiceNotes.length > 10000 || voiceNotes.some(v => !v || !reports.has(v.reportId) || typeof v.audio !== 'string' || v.audio.length > 5600000 || !/^data:audio\//.test(v.audio) || (v.text !== undefined && (typeof v.text !== 'string' || v.text.length > 50000)))) throw new Error('Notas de voz inválidas en el respaldo.');
 if (!Array.isArray(reviewRequests) || reviewRequests.length > 10000 || reviewRequests.some(v => !v || !reports.has(v.reportId) || !['transition','review'].includes(v.action) || !['Borrador','En revisión','Aprobado','Emitido'].includes(v.status) || typeof v.reason !== 'string' || v.reason.length > 5000)) throw new Error('Solicitudes de revisión inválidas en el respaldo.');
 if (new Set(voiceNotes.map(v=>v.reportId)).size !== voiceNotes.length || new Set(reviewRequests.map(v=>v.reportId)).size !== reviewRequests.length) throw new Error('Hay metadatos de informe duplicados en el respaldo.');
 const draftRecoveries=value.draftRecoveries===undefined?[]:value.draftRecoveries;
 if(!Array.isArray(draftRecoveries)||draftRecoveries.length>10000)throw new Error('Copias resguardadas inválidas.');
 const recoveryIds=new Set();
 const normalizedRecoveries=draftRecoveries.map(item=>{
  if(!item||!validId(item.id)||!validId(item.recordId)||!item.data||item.data.id!==item.recordId||recoveryIds.has(item.id)||typeof item.at!=='string'||!Number.isFinite(Date.parse(item.at)))throw new Error('Copia resguardada inválida o duplicada.');
  recoveryIds.add(item.id);
  const data=normalizeBackup({reports:[item.data],companies:entities.companies,version:4},company).entities.reports[0];delete data._backupDeleted;
  return {id:item.id,recordId:item.recordId,at:item.at,data,...(validId(item.recoveredAs)?{recoveredAs:item.recoveredAs}:{})};
 });
 return {entities,voiceNotes:structuredClone(voiceNotes),reviewRequests:structuredClone(reviewRequests),draftRecoveries:normalizedRecoveries,exportedAt:typeof value.exportedAt === 'string' ? value.exportedAt : ''};
}

// Evaluate only rows that would actually be added: existing records always win.
export function planImport(backup, current) {
 const merged = {}, currentIds = {}, summary = []; let imported = 0, skipped = 0, deleted = 0;
 for (const kind of entityKinds) {
  merged[kind] = new Map((current[kind] || []).map(row => [row.id,row]));
  currentIds[kind] = new Set(merged[kind].keys());
  let added = 0, kept = 0;
  for (const row of backup.entities[kind]) {
   if (merged[kind].has(row.id)) { kept++; continue; }
   merged[kind].set(row.id,row); added++; if(row._backupDeleted) deleted++;
  }
  imported += added; skipped += kept;
  if (added || kept) summary.push({kind,label:entityLabels[kind],added,kept});
 }
 const reference = (kind, id, companyId, label) => {
  if (!id) return;
  const row = merged[kind].get(id);
  if (!row || (companyId && row.companyId !== companyId)) throw new Error(`Falta una referencia válida (${label}). Importa un respaldo completo de la misma empresa.`);
 };
 const tags = new Map(), folios = new Map();
 for (const row of merged.equipment.values()) if (!row._sync?.deleted && !row._backupDeleted) {const key=JSON.stringify([row.companyId,String(row.tag).toLowerCase()]);if(!tags.has(key))tags.set(key,[]);tags.get(key).push(row.id);}
 for (const row of merged.reports.values()) {const key=JSON.stringify([row.companyId,row.folio,row.revision||0]);if(!folios.has(key))folios.set(key,[]);folios.get(key).push(row.id);}
 for (const kind of entityKinds) for (const row of backup.entities[kind]) {
  if (currentIds[kind].has(row.id)) continue;
  if (kind !== 'companies') reference('companies',row.companyId,null,entityLabels[kind]);
  for (const [key,target] of [['customerId','customers'],['siteId','sites'],['equipmentId','equipment'],['reportId','reports']]) {
   // customerId in legacy reports is a contact identifier, not a catalog reference.
   if (kind !== 'reports') reference(target,row[key],row.companyId,entityLabels[kind]);
  }
  if (kind !== 'reports' && row.siteId && merged.sites.get(row.siteId)?.customerId !== row.customerId) throw new Error('La instalación no pertenece al cliente indicado en el respaldo.');
  if (kind === 'reports') {
   for (const [key,target] of [['customerRef','customers'],['siteRef','sites'],['equipmentRef','equipment'],['parentId','reports']]) reference(target,row[key],row.companyId,row.folio);
   for (const asset of row.assets) reference('equipment',asset.equipmentId,row.companyId,row.folio);
   for (const source of row.sourceReferences) reference('manuals',source.manualId,row.companyId,row.folio);
  }
  if (kind === 'equipment' && !row._backupDeleted) {
   const duplicate = tags.get(JSON.stringify([row.companyId,row.tag.toLowerCase()]))?.some(id=>id!==row.id);
   if (duplicate) throw new Error(`El TAG «${row.tag}» ya pertenece a otro equipo. Revisa el catálogo antes de importar.`);
  }
  if (kind === 'reports' && folios.get(JSON.stringify([row.companyId,row.folio,row.revision]))?.some(id=>id!==row.id)) throw new Error(`El folio «${row.folio}», revisión ${row.revision}, ya pertenece a otro informe.`);
 }
 for(const recovery of backup.draftRecoveries){const row=recovery.data;reference('companies',row.companyId,null,'Copia resguardada');for(const [key,target]of [['customerRef','customers'],['siteRef','sites'],['equipmentRef','equipment']])reference(target,row[key],row.companyId,'Copia resguardada');}
 const existingRecoveries=new Set((current.meta||[]).map(row=>row.id));
 const recoveredDrafts=backup.draftRecoveries.filter(row=>!existingRecoveries.has('draftRecovery:'+row.id)).length;
 return {imported,skipped,deleted,summary,recoveredDrafts,voices:backup.voiceNotes.length,reviews:backup.reviewRequests.length};
}

export function canSyncEntity(user,kind,row) {
 if (!user || user.role === 'client') return false;
 const companyId=kind === 'companies' ? row.id : row.companyId;
 return (user.role === 'admin' || user.companyIds?.includes('*') || user.companyIds?.includes(companyId)) && (!['companies','reportTemplates','manuals','alertRules'].includes(kind) || ['admin','supervisor'].includes(user.role));
}

export function pendingChanges(snapshot, user, issues = []) {
 const failures = new Map(issues.filter(x=>x.value).map(x=>[x.id,x.value]));
 const rows = [];
 for (const kind of entityKinds) for (const row of snapshot[kind] || []) {
  if (!row._sync?.dirty && !row._sync?.conflict) continue;
  const issue = failures.get(`syncIssue:${kind}:${row.id}`);
  const permitted = !user || canSyncEntity(user,kind,row);
  const status = row._sync.conflict ? 'Conflicto' : !permitted ? 'Sin permiso' : issue ? 'Error de envío' : 'Por enviar';
  rows.push({kind,id:row.id,companyId:kind === 'companies' ? row.id : row.companyId,label:row.folio || row.name || row.id,type:entityLabels[kind],status,detail:issue?.message || (!permitted ? 'La cuenta actual no puede enviar este tipo de registro o empresa.' : row._sync.deleted ? 'Archivado pendiente de sincronizar' : !user ? 'Inicia sesión para sincronizar.' : ''),updatedAt:row.updatedAt || ''});
 }
 return rows.sort((a,b)=>a.label.localeCompare(b.label,'es'));
}
