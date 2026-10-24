import {operationKinds,operationFields,newOperation,normalizeOperation} from './operations.js';
import {validateDesigner} from './designer.js';
import {uid,templates,newReport} from './domain.js';

export const catalogKinds=['customers','sites','equipment','reportTemplates',...operationKinds];
export const entityKinds=['companies',...catalogKinds,'reports'];
export const sectionDefinitions={service:'Identificación del servicio',scope:'Objetivo y alcance',equipment:'Equipos y sistemas',measurements:'Mediciones y pruebas',inspection:'Inspección y verificaciones',development:'Desarrollo y resultados',findings:'Hallazgos',proposal:'Propuesta económica',conclusions:'Conclusiones y recomendaciones',actions:'Plan de acciones',photos:'Registro de evidencias',custom:'Secciones adicionales',signatures:'Responsables y recepción'};
export const requiredFields={workOrder:'OT / referencia',reviewer:'Revisor',customerEmail:'Correo del cliente',diagnosis:'Diagnóstico',recommendations:'Recomendaciones',initialCondition:'Condición inicial',materials:'Materiales',exclusions:'Exclusiones'};
export const catalogFields={
 ...operationFields,
 customers:{name:'Razón social / nombre',taxId:'RUT / identificación fiscal',contact:'Contacto',email:'Correo',phone:'Teléfono / WhatsApp',address:'Dirección',notes:'Notas'},
 sites:{customerId:'Cliente',name:'Nombre de instalación',address:'Dirección',city:'Ciudad',contact:'Contacto en terreno',phone:'Teléfono',notes:'Notas de acceso'},
 equipment:{customerId:'Cliente',siteId:'Instalación',tag:'TAG / código de activo',name:'Nombre del equipo',type:'Tipo / sistema',brand:'Marca',model:'Modelo',serial:'Serie',location:'Ubicación específica',notes:'Notas técnicas'},
 reportTemplates:{name:'Nombre de la plantilla',baseTemplate:'Plantilla base',title:'Título del informe',code:'Código documental',subtitle:'Subtítulo',objective:'Objetivo predeterminado',scope:'Alcance predeterminado',checklistText:'Verificaciones (una por línea)',measurementsText:'Mediciones (Parámetro | Unidad | Referencia, una por línea)'}
};
const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
export function newCatalog(kind,companyId){if(operationKinds.includes(kind))return newOperation(kind,companyId);if(!catalogKinds.includes(kind))throw new Error('Catálogo desconocido.');const now=new Date().toISOString();const row={id:uid(),companyId,createdAt:now,updatedAt:now,...Object.fromEntries(Object.keys(catalogFields[kind]).map(k=>[k,'']))};if(kind==='reportTemplates')Object.assign(row,{baseTemplate:'general',sectionOrder:Object.keys(sectionDefinitions),requiredFields:[],customSections:[],blocks:[],version:1,headerText:'',footerText:''});return row;}
export function validateTemplateSnapshot(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Formato de plantilla inválido.');
 const out={version:Number.isInteger(value.version)&&value.version>0?value.version:1,blocks:validateDesigner(value.blocks||[]),headerText:String(value.headerText||'').slice(0,1000),footerText:String(value.footerText||'').slice(0,2000)};for(const k of ['id','name','title','code','subtitle']){if(typeof value[k]!=='string'||value[k].length>500)throw new Error('Identidad de plantilla inválida.');out[k]=value[k];}
 if(!validId(out.id)||!out.name.trim())throw new Error('Identidad de plantilla inválida.');
 if(!Array.isArray(value.sectionOrder)||value.sectionOrder.length!==Object.keys(sectionDefinitions).length||new Set(value.sectionOrder).size!==value.sectionOrder.length||value.sectionOrder.some(k=>!Object.hasOwn(sectionDefinitions,k)))throw new Error('Orden de secciones inválido.');
 if(!Array.isArray(value.requiredFields)||value.requiredFields.length>Object.keys(requiredFields).length||value.requiredFields.some(k=>!Object.hasOwn(requiredFields,k)))throw new Error('Campos obligatorios inválidos.');
 if(!Array.isArray(value.customSections)||value.customSections.length>20)throw new Error('Máximo 20 secciones adicionales.');
 out.sectionOrder=[...value.sectionOrder];out.requiredFields=[...new Set(value.requiredFields)];
 out.customSections=value.customSections.map(s=>{if(!s||!validId(s.id)||typeof s.title!=='string'||!s.title.trim()||s.title.length>200||typeof s.required!=='boolean')throw new Error('Sección adicional inválida.');return {id:s.id,title:s.title,required:s.required};});
 if(new Set(out.customSections.map(s=>s.id)).size!==out.customSections.length)throw new Error('Secciones adicionales duplicadas.');
 return out;
}
export function normalizeCatalog(kind,input){
 if(operationKinds.includes(kind))return normalizeOperation(kind,input);
 if(!catalogKinds.includes(kind)||!input||!validId(input.id)||!validId(input.companyId))throw new Error('Registro de catálogo inválido.');
 const out={id:input.id,companyId:input.companyId,createdAt:input.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 for(const k of Object.keys(catalogFields[kind])){const v=input[k]??'';if(typeof v!=='string'||v.length>(['notes','objective','scope','checklistText','measurementsText'].includes(k)?10000:500))throw new Error('Campo inválido: '+catalogFields[kind][k]);out[k]=v;}
 out.name=out.name.trim();if(kind==='equipment')out.tag=out.tag.trim();
 if(!out.name.trim())throw new Error('Completa el nombre del registro.');
 if(typeof out.createdAt!=='string'||!Number.isFinite(Date.parse(out.createdAt)))throw new Error('Fecha de creación inválida.');
 for(const k of ['customerId','siteId'])if(k in out&&out[k]&&!validId(out[k]))throw new Error('Referencia inválida.');
 if(kind==='sites'&&!out.customerId)throw new Error('Selecciona el cliente de la instalación.');
 if(kind==='equipment'&&(!out.customerId||!out.siteId||!out.tag.trim()))throw new Error('El equipo necesita cliente, instalación y TAG.');
 if(kind==='reportTemplates'){
  if(!Object.hasOwn(templates,out.baseTemplate))throw new Error('Plantilla base inválida.');
  Object.assign(out,validateTemplateSnapshot({...input,title:out.title||templates[out.baseTemplate].title,code:out.code||templates[out.baseTemplate].code,subtitle:out.subtitle||templates[out.baseTemplate].subtitle}));
  if(out.checklistText.split('\n').filter(x=>x.trim()).length>300||out.measurementsText.split('\n').filter(x=>x.trim()).length>200)throw new Error('Demasiadas verificaciones o mediciones.');
 }
 return out;
}
export function createFromTemplate(record,company,folio){
 const t=normalizeCatalog('reportTemplates',record),r=newReport(t.baseTemplate,company,folio);
 r.templateId=t.id;r.templateSnapshot=validateTemplateSnapshot(t);r.title=t.title;r.objective=t.objective;r.scope=t.scope;
 r.designerValues=Object.fromEntries(t.blocks.map(b=>[b.id,b.type==='table'?[]:'']));r.customSections=t.customSections.map(s=>({...s,content:''}));
 if(t.checklistText.trim())r.checklist=t.checklistText.split('\n').filter(s=>s.trim()).map(label=>({id:uid(),label:label.trim(),condition:'',notes:''}));
 if(t.measurementsText.trim())r.measurements=t.measurementsText.split('\n').filter(s=>s.trim()).map(line=>{const [label='',unit='',reference='']=line.split('|').map(s=>s.trim());return {id:uid(),label,unit,reference,value:''};});
 return r;
}
export function selectCustomer(r,customer){if(customer.companyId!==r.companyId)throw new Error('El cliente pertenece a otra empresa.');Object.assign(r,{customerRef:customer.id,customerCompany:customer.name,customerName:customer.contact,customerEmail:customer.email,customerPhone:customer.phone,siteRef:'',equipmentRef:'',site:''});r.equipment=Object.fromEntries(Object.keys(r.equipment).map(k=>[k,'']));}
export function selectSite(r,site,customers){const c=customers.find(c=>c.id===site.customerId);if(!c||site.companyId!==r.companyId)throw new Error('No se encuentra el cliente de esta instalación.');selectCustomer(r,c);r.siteRef=site.id;r.site=[site.name,site.address,site.city].filter(Boolean).join(' · ');}
export function selectEquipment(r,equipment,sites,customers){if(!equipment||equipment.companyId!==r.companyId)throw new Error('El equipo pertenece a otra empresa.');const s=sites.find(s=>s.id===equipment.siteId);if(!s||s.customerId!==equipment.customerId)throw new Error('No se encuentra la instalación de este equipo.');selectSite(r,s,customers);r.equipmentRef=equipment.id;Object.assign(r.equipment,{equipmentType:equipment.type||equipment.name,assetTag:equipment.tag,brand:equipment.brand,model:equipment.model,serial:equipment.serial,location:equipment.location});}
export function equipmentHistory(reports,id){return reports.filter(r=>r.equipmentRef===id||r.assets?.some(a=>a.equipmentId===id)).sort((a,b)=>(b.serviceDate||'').localeCompare(a.serviceDate||'')||(b.revision||0)-(a.revision||0));}
