import {normalizeCatalog,validateTemplateSnapshot} from '../public/js/catalogs.js';
import {newReport,templates,validateReport,safeImage} from '../public/js/domain.js';
export class HttpError extends Error{constructor(status,message,extra={}){super(message);this.status=status;this.extra=extra;}}
export const fail=(status,message,extra)=>{throw new HttpError(status,message,extra);};
export const idValid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export async function jsonBody(request,max=12000000){const len=Number(request.headers.get('Content-Length')||0);if(len>max)fail(413,'El documento supera el tamaño permitido.');const reader=request.body?.getReader();if(!reader)fail(400,'Falta el contenido de la solicitud.');const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'El documento supera el tamaño permitido.');}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Contenido JSON inválido.');}}
const text=(v,max=50000)=>{if(typeof v!=='string'||v.length>max)fail(400,'Un campo de texto es inválido o demasiado extenso.');return v;};
export function validateCompany(data){if(!data||typeof data!=='object'||!idValid(data.id))fail(400,'Empresa inválida.');const out={id:data.id};for(const k of ['name','tradeName','taxId','address','city','country','email','phone','website','footer','currency','color','accent'])out[k]=text(data[k]??'',k==='footer'?2000:500);if(!out.name.trim())fail(400,'La empresa necesita una razón social.');out.logo=text(data.logo||'',1000000);if(out.logo&&!safeImage(out.logo))fail(400,'Logo inválido.');out.updatedAt=new Date().toISOString();return out;}
export function validateReportData(data){
 if(!data||typeof data!=='object'||!idValid(data.id)||!Object.hasOwn(templates,data.template))fail(400,'Informe inválido.');
 const base=newReport(data.template,null,data.folio),out={};
 for(const key of Object.keys(base))out[key]=data[key]??base[key];
 for(const key of ['id','folio','title','serviceDate','workOrder','technician','reviewer','customerCompany','customerName','customerEmail','customerPhone','customerId','customerRole','site','maintenanceType','objective','scope','exclusions','initialCondition','workPerformed','diagnosis','observations','recommendations','conclusions','materials','result','proposalTerms','proposalValidity','proposalDeadline','taxRate','customerRef','siteRef','equipmentRef','templateId'])text(out[key]);
 if(out.folio.length>150||out.title.length>500)fail(400,'Título o folio demasiado extenso.');
 if(!['Borrador','En revisión','Aprobado','Emitido'].includes(out.status)||!Number.isInteger(out.revision)||out.revision<0)fail(400,'Estado o revisión inválidos.');
 if(!idValid(out.companyId))fail(400,'Selecciona una empresa emisora.');
 out.companySnapshot=validateCompany(out.companySnapshot);
 for(const [key,max,fields]of [['measurements',200,['id','label','value','unit','reference']],['checklist',300,['id','label','condition','notes']],['photos',24,['id','dataUrl','caption','tag']],['assets',150,['id','tag','name','model','serial','notes','equipmentId']],['actions',150,['id','description','priority','owner','dueDate','status']],['proposalItems',300,['id','description','quantity','unit','price']],['history',2000,['at','action','by']]]){
  if(!Array.isArray(out[key])||out[key].length>max)fail(400,`Cantidad de elementos inválida: ${key}.`);
  out[key]=out[key].map(item=>{if(!item||typeof item!=='object')fail(400,'Elemento inválido.');const copy={};for(const k of fields)copy[k]=text(item[k]??'',k==='dataUrl'?1000000:10000);return copy;});
 }
 for(const i of out.checklist)if(!['','Conforme','Atención','No conforme','No aplica'].includes(i.condition))fail(400,'Condición de inspección inválida.');
 for(const p of out.photos)if(!safeImage(p.dataUrl))fail(400,'Fotografía inválida.');
 for(const k of ['clientSignature','technicianSignature']){text(out[k],1000000);if(out[k]&&!safeImage(out[k]))fail(400,'Firma inválida.');}
 for(const key of ['equipment','schedule']){if(!out[key]||typeof out[key]!=='object')fail(400,'Datos de equipo inválidos.');out[key]=Object.fromEntries(Object.keys(base[key]).map(k=>[k,text(out[key][k]??'',1000)]));}
 for(const i of out.proposalItems)if(!Number.isFinite(Number(i.quantity))||!Number.isFinite(Number(i.price))||Number(i.quantity)<0||Number(i.price)<0)fail(400,'Cantidad o precio inválido.');
 for(const key of ['createdAt','updatedAt'])if(typeof out[key]!=='string'||!Number.isFinite(Date.parse(out[key])))fail(400,'Fecha de registro inválida.');
 for(const k of ['customerRef','siteRef','equipmentRef','templateId'])if(out[k]&&!idValid(out[k]))fail(400,'Referencia de catálogo inválida.');
 if(out.templateSnapshot!==null){try{out.templateSnapshot=validateTemplateSnapshot(out.templateSnapshot);}catch(error){fail(400,error.message);}if(out.templateId!==out.templateSnapshot.id)fail(400,'Referencia de plantilla inconsistente.');}
 if(out.templateId&&!out.templateSnapshot)fail(400,'Falta la copia de la plantilla.');
 if(!Array.isArray(out.findings)||out.findings.length>150)fail(400,'Máximo 150 hallazgos.');
 out.findings=out.findings.map(f=>{if(!f||!idValid(f.id))fail(400,'Hallazgo inválido.');const copy={id:f.id};for(const k of ['title','description','priority','recommendation','owner','dueDate','status','resolution','equipmentTag'])copy[k]=text(f[k]??'',10000);if(!['Baja','Media','Alta','Crítica'].includes(copy.priority)||!['Pendiente','En curso','Resuelto'].includes(copy.status))fail(400,'Prioridad o estado de hallazgo inválido.');if(copy.dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(copy.dueDate))fail(400,'Fecha de hallazgo inválida.');if(!Array.isArray(f.photoIds)||f.photoIds.length>24||f.photoIds.some(id=>!idValid(id)||!out.photos.some(p=>p.id===id)))fail(400,'Fotografía de hallazgo inexistente.');copy.photoIds=[...new Set(f.photoIds)];return copy;});
 if(new Set(out.findings.map(f=>f.id)).size!==out.findings.length||new Set(out.photos.map(p=>p.id)).size!==out.photos.length)fail(400,'Identificadores de evidencias o hallazgos duplicados.');
 if(!Array.isArray(out.customSections)||out.customSections.length>20)fail(400,'Secciones adicionales inválidas.');
 out.customSections=out.customSections.map(s=>{if(!s||!idValid(s.id)||typeof s.required!=='boolean')fail(400,'Sección adicional inválida.');return {id:s.id,title:text(s.title,200),content:text(s.content),required:s.required};});
 if(out.templateSnapshot){const definitions=out.templateSnapshot.customSections;if(definitions.length!==out.customSections.length||definitions.some(d=>!out.customSections.some(s=>s.id===d.id&&s.title===d.title&&s.required===d.required)))fail(400,'Las secciones no corresponden a la plantilla del informe.');}
 out.legacyImported=data.legacyImported===true;
 if(out.status==='Emitido'&&!out.legacyImported){const errors=validateReport(out);if(errors.length)fail(422,'El documento no está completo: '+errors.join(', '));}
 return out;
}

export function validateCatalog(kind,data){try{return normalizeCatalog(kind,data);}catch(error){fail(400,error.message);}}
