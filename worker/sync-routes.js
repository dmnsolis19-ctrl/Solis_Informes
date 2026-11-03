// Sincronización: cambios locales hacia el servidor y cambios del servidor hacia los dispositivos.
import {enterpriseRoute,assertWrite,requireCompany,scopeFilter,requireStaff,allowedCompany,logEvent} from './enterprise.js';
import {entityKinds,catalogKinds} from '../public/js/catalogs.js';
import {sha256,randomToken,hashPassword,constantEqual,getUser,createSession,cookie,rateLimit} from './auth.js';
import {HttpError,fail,idValid,jsonBody,validateCompany,validateReportData,validateCatalog} from './validation.js';
import {renderDocument} from '../public/js/render.js';
import {escapeHtml as e} from '../public/js/domain.js';
import {baseHeaders,json,dto,entity} from './http.js';
import {externalize} from './files.js';
export async function syncRoute(req,env,user,url){
 const path=url.pathname;
 if(path==='/api/sync/push'&&req.method==='POST'){
  const b=await jsonBody(req);if(!entityKinds.includes(b.kind)||!idValid(b.id)||!idValid(b.mutationId)||!Number.isInteger(b.baseVersion)||b.baseVersion<0||typeof b.deleted!=='boolean')fail(400,'Cambio de sincronización inválido.');
  const current=await entity(env,user,b.kind,b.id);
  if(current)requireCompany(user,b.kind==='companies'?current.id:JSON.parse(current.data).companyId);
  if(current?.mutation_id===b.mutationId)return json({version:current.version,id:current.id});
  if((current?.version||0)!==b.baseVersion)fail(409,'Este registro cambió en otro dispositivo.',{remote:current?dto(current):{id:b.id,kind:b.kind,version:0,deleted:true,data:{id:b.id}}});
  if(current&&b.kind==='reports'&&JSON.parse(current.data).status==='Emitido')fail(423,'La versión emitida está bloqueada. Crea una revisión.');
  if(current&&Number(req.headers.get('X-Solis-Client')||2)<3){const old=JSON.parse(current.data);if(old.templateSnapshot||old.customerRef||old.siteRef||old.equipmentRef||old.findings?.length||old.customSections?.length||old.assets?.some(a=>a.equipmentId))fail(426,'Actualiza la aplicación antes de editar este registro.');}
  if(current&&JSON.parse(current.data).schemaVersion>=4&&Number(req.headers.get('X-Solis-Client')||2)<4)fail(426,'Actualiza a SOLIS Field Pro 3 antes de editar este documento.');
  if(current&&Number(req.headers.get('X-Solis-Client')||2)<5){const old=JSON.parse(current.data);if(old.documentLayout||old.templateSnapshot?.documentLayout)fail(426,'Actualiza a SOLIS Field Pro 3.5 para conservar la estructura personalizada.');}
  if(current&&Number(req.headers.get('X-Solis-Client')||2)<6){const old=JSON.parse(current.data);if(old.charts?.length||old.clientSignedAt||old.photos?.some(p=>p.takenAt||p.geo))fail(426,'Actualiza a SOLIS Field Pro 3.6 para conservar los gráficos, fechas de firma y datos de fotografías.');}
  const data=b.kind==='reports'?validateReportData(b.data):b.kind==='companies'?validateCompany(b.data):validateCatalog(b.kind,b.data);if(data.id!==b.id)fail(400,'Identificador inconsistente.');assertWrite(user,b.kind,data,current,b.deleted);if(b.kind==='reports'&&data.derivedFrom){const source=await entity(env,user,'reports',data.derivedFrom.id);if(!source||source.deleted||JSON.parse(source.data).companyId!==data.companyId||!['Aprobado','Emitido'].includes(JSON.parse(source.data).status))fail(400,'Documento de origen no disponible o sin aprobar.');}
  if(catalogKinds.includes(b.kind)){
   if(current&&JSON.parse(current.data).companyId!==data.companyId)fail(400,'La empresa del catálogo no se puede cambiar.');
   const company=await entity(env,user,'companies',data.companyId);if(!company)fail(400,'Sincroniza primero la empresa del catálogo.');
   for(const [key,kind] of [['customerId','customers'],['siteId','sites'],['equipmentId','equipment'],['reportId','reports']])if(data[key]){const parent=await entity(env,user,kind,data[key]);if(!parent||JSON.parse(parent.data).companyId!==data.companyId)fail(400,'Referencia de catálogo de otra empresa o inexistente.');if(key==='siteId'&&JSON.parse(parent.data).customerId!==data.customerId)fail(400,'La instalación no pertenece al cliente seleccionado.');}
  }
  if(b.kind==='reports'){
   for(const asset of data.assets)if(asset.equipmentId){if(!idValid(asset.equipmentId))fail(400,'Referencia de equipo inválida.');const ref=await entity(env,user,'equipment',asset.equipmentId);if(!ref||JSON.parse(ref.data).companyId!==data.companyId)fail(400,'Equipo adicional de otra empresa o inexistente.');}
   for(const [key,kind]of [['customerRef','customers'],['siteRef','sites'],['equipmentRef','equipment']])if(data[key]){const ref=await entity(env,user,kind,data[key]);if(!ref||JSON.parse(ref.data).companyId!==data.companyId)fail(400,'Referencia del informe de otra empresa o inexistente.');}
  }
  if(b.kind==='reports'&&data.parentId){const parent=await entity(env,user,'reports',data.parentId);if(!parent||JSON.parse(parent.data).folio!==data.folio||data.revision<=(JSON.parse(parent.data).revision||0))fail(400,'No existe una versión anterior válida de este documento.');}
  for(const ref of data.sourceReferences||[]){const manual=await entity(env,user,'manuals',ref.manualId);if(!manual||JSON.parse(manual.data).companyId!==data.companyId)fail(400,'Fuente documental de otra empresa o inexistente.');}
  for(const key of ['ownerId','assignedTo'])if(data[key]){const member=await env.DB.prepare('SELECT id,role,company_ids FROM users WHERE id=? AND workspace_id=? AND active=1').bind(data[key],user.workspaceId).first();if(!member||member.role==='client'||!(member.role==='admin'||JSON.parse(member.company_ids).some(id=>id==='*'||id===data.companyId)))fail(400,'La cuenta asignada no tiene acceso a esta empresa.');}
  const stored=await externalize(data,env,user.workspaceId,b.kind==='companies'?data.id:data.companyId,user),serialized=JSON.stringify(stored);if(new TextEncoder().encode(serialized).length>500000)fail(413,'El contenido del informe es demasiado extenso.');
  const version=b.baseVersion+1,at=new Date().toISOString();let result;
  try{result=await env.DB.prepare('INSERT INTO entities(workspace_id,kind,id,version,mutation_id,deleted,folio,revision,data,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,kind,id) DO UPDATE SET version=excluded.version,mutation_id=excluded.mutation_id,deleted=excluded.deleted,folio=excluded.folio,revision=excluded.revision,data=excluded.data,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE entities.version=?').bind(user.workspaceId,b.kind,b.id,version,b.mutationId,b.deleted?1:0,b.kind==='reports'?data.folio:null,data.revision||0,serialized,at,user.id,b.baseVersion).run();}catch(error){if(/UNIQUE constraint failed/.test(error.message))fail(409,b.kind==='equipment'?'Este TAG ya existe en el catálogo de la empresa.':'Ya existe un documento con ese folio y revisión. Modifica el folio del borrador.');throw error;}
  if(!result.meta.changes){const remote=await entity(env,user,b.kind,b.id);if(remote?.mutation_id===b.mutationId)return json({version:remote.version,id:remote.id});fail(409,'El registro cambió mientras se guardaba.',{remote:dto(remote)});}
  await logEvent(env,user,b.kind==='companies'?data.id:data.companyId,b.id,b.deleted?'Registro archivado':'Registro guardado',b.kind);
  return json({version,id:b.id,serverFields:Object.fromEntries(['createdBy','ownerId',...(b.kind==='reportTemplates'?['version']:[])].filter(k=>data[k]!==undefined).map(k=>[k,data[k]]))});
 }
 if(path==='/api/sync/pull'&&req.method==='GET'){
  const since=Number(url.searchParams.get('since')||0);if(!Number.isSafeInteger(since)||since<0)fail(400,'Cursor inválido.');
  const protocol=url.searchParams.get('protocol');const compatible=protocol==='4'?'':protocol==='3'?" AND e.kind IN ('reports','companies','customers','sites','equipment','reportTemplates')":" AND e.kind IN ('reports','companies')";const scope=scopeFilter(user);
  const result=await env.DB.prepare(`SELECT c.seq,e.* FROM change_log c JOIN entities e ON e.workspace_id=c.workspace_id AND e.kind=c.kind AND e.id=c.entity_id AND e.version=c.version WHERE c.workspace_id=? AND c.seq>?${compatible} AND ${scope.sql} ORDER BY c.seq LIMIT 51`).bind(user.workspaceId,since,...scope.args).all();const more=result.results.length>50,rows=result.results.slice(0,50);let cursor=rows.at(-1)?.seq||since;if(!more){const max=await env.DB.prepare('SELECT MAX(seq) AS cursor FROM change_log WHERE workspace_id=?').bind(user.workspaceId).first();cursor=Math.max(cursor,max.cursor||0);}return json({items:rows.map(dto),cursor,more});
 }
 return null;
}
