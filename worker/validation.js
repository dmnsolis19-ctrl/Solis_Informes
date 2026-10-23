import {newReport,templates,validateReport,safeImage} from '../public/js/domain.js';
export class HttpError extends Error{constructor(status,message,extra={}){super(message);this.status=status;this.extra=extra;}}
export const fail=(status,message,extra)=>{throw new HttpError(status,message,extra);};
export const idValid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export async function jsonBody(request,max=12000000){const len=Number(request.headers.get('Content-Length')||0);if(len>max)fail(413,'El documento supera el tamaño permitido.');const reader=request.body?.getReader();if(!reader)fail(400,'Falta el contenido de la solicitud.');const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'El documento supera el tamaño permitido.');}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Contenido JSON inválido.');}}
const text=(v,max=50000)=>{if(typeof v!=='string'||v.length>max)fail(400,'Un campo de texto es inválido o demasiado extenso.');return v;};
export function validateCompany(data){if(!data||typeof data!=='object'||!idValid(data.id))fail(400,'Empresa inválida.');const out={id:data.id};for(const k of ['name','tradeName','taxId','address','city','country','email','phone','website','footer','currency','color','accent'])out[k]=text(data[k]??'',k==='footer'?2000:500);if(!out.name.trim())fail(400,'La empresa necesita una razón social.');out.logo=text(data.logo||'',1000000);if(out.logo&&!safeImage(out.logo))fail(400,'Logo inválido.');out.updatedAt=new Date().toISOString();return out;}
export function validateReportData(data){
 if(!data||typeof data!=='object'||!idValid(data.id)||!templates[data.template])fail(400,'Informe inválido.');
 const base=newReport(data.template,null,data.folio),out={};
 for(const key of Object.keys(base))out[key]=data[key]??base[key];
 for(const key of ['id','folio','title','serviceDate','workOrder','technician','reviewer','customerCompany','customerName','customerEmail','customerPhone','customerId','customerRole','site','maintenanceType','objective','scope','exclusions','initialCondition','workPerformed','diagnosis','observations','recommendations','conclusions','materials','result','proposalTerms','proposalValidity','proposalDeadline','taxRate'])text(out[key]);
 if(out.folio.length>150||out.title.length>500)fail(400,'Título o folio demasiado extenso.');
 if(!['Borrador','En revisión','Aprobado','Emitido'].includes(out.status)||!Number.isInteger(out.revision)||out.revision<0)fail(400,'Estado o revisión inválidos.');
 if(!idValid(out.companyId))fail(400,'Selecciona una empresa emisora.');
 out.companySnapshot=validateCompany(out.companySnapshot);
 for(const [key,max,fields]of [['measurements',200,['id','label','value','unit','reference']],['checklist',300,['id','label','condition','notes']],['photos',24,['id','dataUrl','caption','tag']],['assets',150,['id','tag','name','model','serial','notes']],['actions',150,['id','description','priority','owner','dueDate','status']],['proposalItems',300,['id','description','quantity','unit','price']],['history',2000,['at','action','by']]]){
  if(!Array.isArray(out[key])||out[key].length>max)fail(400,`Cantidad de elementos inválida: ${key}.`);
  out[key]=out[key].map(item=>{if(!item||typeof item!=='object')fail(400,'Elemento inválido.');const copy={};for(const k of fields)copy[k]=text(item[k]??'',k==='dataUrl'?1000000:10000);return copy;});
 }
 for(const i of out.checklist)if(!['','Conforme','Atención','No conforme','No aplica'].includes(i.condition))fail(400,'Condición de inspección inválida.');
 for(const p of out.photos)if(!safeImage(p.dataUrl))fail(400,'Fotografía inválida.');
 for(const k of ['clientSignature','technicianSignature']){text(out[k],1000000);if(out[k]&&!safeImage(out[k]))fail(400,'Firma inválida.');}
 for(const key of ['equipment','schedule']){if(!out[key]||typeof out[key]!=='object')fail(400,'Datos de equipo inválidos.');out[key]=Object.fromEntries(Object.keys(base[key]).map(k=>[k,text(out[key][k]??'',1000)]));}
 for(const i of out.proposalItems)if(!Number.isFinite(Number(i.quantity))||!Number.isFinite(Number(i.price))||Number(i.quantity)<0||Number(i.price)<0)fail(400,'Cantidad o precio inválido.');
 for(const key of ['createdAt','updatedAt'])if(typeof out[key]!=='string'||!Number.isFinite(Date.parse(out[key])))fail(400,'Fecha de registro inválida.');
 out.legacyImported=data.legacyImported===true;
 if(out.status==='Emitido'&&!out.legacyImported){const errors=validateReport(out);if(errors.length)fail(422,'El documento no está completo: '+errors.join(', '));}
 return out;
}
