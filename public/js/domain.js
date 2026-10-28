import {specialtyTemplates} from './specialties.js';
import {validateLayout,layoutIncomplete} from './document-layout.js';
import {designerMissing} from './designer.js';
const generatorMeasurements = [
  { label: "Voltaje L1-N", unit: "V", value: "", reference: "" }, { label: "Voltaje L2-N", unit: "V", value: "", reference: "" },
  { label: "Voltaje L3-N", unit: "V", value: "", reference: "" }, { label: "Voltaje L1-L2", unit: "V", value: "", reference: "" },
  { label: "Voltaje L2-L3", unit: "V", value: "", reference: "" }, { label: "Voltaje L3-L1", unit: "V", value: "", reference: "" },
  { label: "Corriente L1", unit: "A", value: "", reference: "" }, { label: "Corriente L2", unit: "A", value: "", reference: "" },
  { label: "Corriente L3", unit: "A", value: "", reference: "" }, { label: "Frecuencia", unit: "Hz", value: "", reference: "50 ± 1" },
  { label: "Velocidad motor", unit: "rpm", value: "", reference: "" }, { label: "Potencia activa", unit: "kW", value: "", reference: "" },
  { label: "Carga", unit: "%", value: "", reference: "" }, { label: "Presión de aceite", unit: "bar", value: "", reference: "" },
  { label: "Temperatura refrigerante", unit: "°C", value: "", reference: "" }, { label: "Voltaje batería", unit: "Vdc", value: "", reference: "" },
  { label: "Nivel de combustible", unit: "%", value: "", reference: "" },
];
const generatorChecklist = ["Nivel y condición del aceite motor", "Nivel y condición del refrigerante", "Fugas de aceite, combustible o refrigerante", "Correas, mangueras y abrazaderas", "Filtro de aire", "Filtros y circuito de combustible", "Batería, bornes y cargador", "Radiador y sistema de ventilación", "Sistema de escape", "Tablero, alarmas y controlador", "Arranque manual y automático", "Transferencia ATS / red-grupo", "Parada de emergencia", "Protecciones eléctricas", "Limpieza general del equipo y sala"];
const instrumentationMeasurements = [
  { label: "Variable de proceso (PV)", unit: "", value: "", reference: "Según rango configurado" },
  { label: "Señal de salida", unit: "mA", value: "", reference: "4–20 mA" },
  { label: "Alimentación", unit: "Vdc", value: "", reference: "Según fabricante" },
  { label: "Error de medición", unit: "%", value: "", reference: "Según tolerancia" },
  { label: "Valor patrón", unit: "", value: "", reference: "Patrón certificado" },
];
const instrumentationChecklist = ["Identificación y TAG del instrumento", "Estado físico, montaje y orientación", "Conexiones de proceso, tubing e impulsos", "Prensaestopas, cableado y borneras", "Alimentación eléctrica", "Señal analógica o digital", "Puesta a tierra y blindaje", "Rango, unidad y configuración", "Comunicación y diagnóstico", "Alarmas e interbloqueos asociados", "Prueba funcional en terreno", "Estado de calibración y sello"];
const surveyChecklist = ["Alcance y necesidad del cliente", "Ubicación, área y accesibilidad", "Condición actual de la instalación", "Fuentes de alimentación y control disponibles", "Rutas de canalización y cableado", "Distancias y dimensiones principales", "Puntos de conexión o tie-in", "Condiciones ambientales y clasificación de área", "Riesgos, permisos y restricciones de trabajo", "Registro fotográfico suficiente", "Planos y documentos disponibles", "Información pendiente por confirmar"];
const diagnosticMeasurements = [
  { label: "Tensión de alimentación", unit: "V", value: "", reference: "Según placa" },
  { label: "Corriente de operación", unit: "A", value: "", reference: "Según placa" },
  { label: "Frecuencia", unit: "Hz", value: "", reference: "Según sistema" },
  { label: "Temperatura", unit: "°C", value: "", reference: "Según fabricante" },
  { label: "Resistencia de aislamiento", unit: "MΩ", value: "", reference: "Según norma/manual" },
];
const diagnosticChecklist = ["Falla reportada y condiciones de ocurrencia", "Inspección visual y condición física", "Alarmas, eventos y códigos de error", "Alimentación y protecciones", "Cableado, borneras y conexiones", "Entradas, salidas y señales de control", "Parámetros y configuración", "Comunicaciones industriales", "Pruebas funcionales ejecutadas", "Causa probable o causa raíz", "Condición operativa al finalizar", "Acciones pendientes y repuestos requeridos"];
const generalChecklist = ["Alcance confirmado con el cliente", "Identificación del sistema o equipo", "Condición inicial registrada", "Riesgos y condiciones de seguridad", "Actividades y pruebas ejecutadas", "Resultados comunicados al cliente", "Evidencias fotográficas suficientes", "Pendientes, responsables y plazos"];

export const templates = {
  generator: { label: "Mantenimiento de grupo electrógeno", shortLabel: "Grupo electrógeno", icon: "GE", prefix: "MT", code: "SIG-OYM-REG-001", title: "Servicio y mantenimiento", subtitle: "GRUPO ELECTRÓGENO", description: "Mantenimiento preventivo, correctivo, pruebas y control por horómetro.", serviceOptions: ["Preventivo", "Correctivo", "Predictivo", "Inspección", "Emergencia", "Puesta en marcha"], defaultService: "Preventivo", measurements: generatorMeasurements, checklist: generatorChecklist },
  instrumentation: { label: "Visita técnica de instrumentación", shortLabel: "Instrumentación", icon: "IN", prefix: "IT", code: "SIG-INS-REG-001", title: "Visita técnica", subtitle: "INSTRUMENTACIÓN Y CONTROL", description: "Inspección de instrumentos, lazos, señales, calibración y comunicaciones.", serviceOptions: ["Inspección técnica", "Verificación de lazo", "Calibración", "Diagnóstico", "Puesta en marcha", "Asistencia técnica"], defaultService: "Inspección técnica", measurements: instrumentationMeasurements, checklist: instrumentationChecklist },
  survey: { label: "Levantamiento técnico", shortLabel: "Levantamiento", icon: "LT", prefix: "LV", code: "SIG-ING-REG-001", title: "Levantamiento técnico", subtitle: "INGENIERÍA EN TERRENO", description: "Captura condiciones existentes, dimensiones, rutas, puntos de conexión y pendientes.", serviceOptions: ["Levantamiento eléctrico", "Levantamiento de control", "Levantamiento de instrumentación", "Levantamiento mecánico", "Visita de factibilidad", "Inspección de obra"], defaultService: "Levantamiento de instrumentación", measurements: [], checklist: surveyChecklist },
  diagnostic: { label: "Diagnóstico de equipo", shortLabel: "Diagnóstico", icon: "DG", prefix: "DG", code: "SIG-SAT-REG-001", title: "Diagnóstico técnico", subtitle: "EQUIPO O SISTEMA", description: "Registra síntomas, mediciones, pruebas, causa probable y acciones recomendadas.", serviceOptions: ["Diagnóstico de falla", "Evaluación de condición", "Prueba funcional", "Análisis de alarmas", "Soporte de emergencia"], defaultService: "Diagnóstico de falla", measurements: diagnosticMeasurements, checklist: diagnosticChecklist },
  general: { label: "Informe técnico general", shortLabel: "Informe general", icon: "IG", prefix: "IT", code: "SIG-TEC-REG-001", title: "Informe técnico", subtitle: "SERVICIO EN TERRENO", description: "Plantilla flexible para asistencia, inspecciones y trabajos no cubiertos por otra categoría.", serviceOptions: ["Visita técnica", "Asistencia técnica", "Inspección", "Reparación", "Puesta en marcha", "Otro"], defaultService: "Visita técnica", measurements: [], checklist: generalChecklist },
};

Object.assign(templates, {
 proposal: {label:'Propuesta técnica y económica',shortLabel:'Propuesta',icon:'PR',prefix:'PR',code:'COM-PR-001',title:'Propuesta técnica y económica',subtitle:'SOLUCIÓN Y ALCANCE',description:'Presenta una solución, su alcance, presupuesto y condiciones.',defaultService:'Propuesta técnica',serviceOptions:['Propuesta técnica','Propuesta económica','Ampliación de alcance'],measurements:[],checklist:['Necesidad y alcance definidos','Exclusiones identificadas','Entregables definidos','Plazo y condiciones confirmados']},
 evaluation: {label:'Evaluación en terreno',shortLabel:'Evaluación',icon:'EV',prefix:'EV',code:'TEC-EV-001',title:'Evaluación en terreno',subtitle:'CONDICIÓN Y FACTIBILIDAD',description:'Evalúa condiciones, restricciones, riesgos y oportunidades de mejora.',defaultService:'Evaluación de condición',serviceOptions:['Evaluación de condición','Factibilidad','Inspección de seguridad'],measurements:[],checklist:surveyChecklist},
 failure: {label:'Análisis de falla',shortLabel:'Fallas',icon:'AF',prefix:'AF',code:'TEC-AF-001',title:'Análisis de falla',subtitle:'EVIDENCIAS Y CAUSAS',description:'Documenta la falla, las pruebas, las hipótesis y las acciones correctivas.',defaultService:'Análisis de falla',serviceOptions:['Análisis de falla','Causa probable','Análisis de recurrencia'],measurements:diagnosticMeasurements,checklist:diagnosticChecklist},
 commissioning: {label:'Pruebas y puesta en marcha',shortLabel:'Puesta en marcha',icon:'PM',prefix:'PM',code:'TEC-PM-001',title:'Pruebas y puesta en marcha',subtitle:'VERIFICACIÓN FUNCIONAL',description:'Registra verificaciones, pruebas, aceptación y pendientes de entrega.',defaultService:'Puesta en marcha',serviceOptions:['Puesta en marcha','Prueba funcional','SAT','FAT'],measurements:diagnosticMeasurements,checklist:['Documentación y planos verificados','Condiciones previas verificadas','Protecciones y seguridad verificadas','Pruebas funcionales ejecutadas','Resultados y pendientes registrados','Entrega al cliente realizada']}
});
Object.assign(templates,specialtyTemplates);
export const templateOrder = Object.keys(templates);
export const uid = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
export const localDate = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const fmtDate = v => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v+'T12:00:00').toLocaleDateString('es-CL') : '—';
export const escapeHtml = v => String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeImage = v => /^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|\/api\/assets\/[a-f0-9]{64})$/.test(String(v||'')) ? v : '';
export function newCompany(){return {id:uid(),name:'',tradeName:'',taxId:'',address:'',city:'',country:'Chile',email:'',phone:'',website:'',logo:'',color:'#123f54',accent:'#129e85',footer:'',currency:'CLP',updatedAt:new Date().toISOString()};}
export function newReport(template='general',company,folio='') {
 const d=Object.hasOwn(templates,template)?templates[template]:templates.general, now=new Date().toISOString();
 return {documentLayout:null,schemaVersion:4,createdBy:'',assignedTo:'',approvedBy:'',approvedAt:'',issuedBy:'',issuedAt:'',reviewedBy:'',reviewedAt:'',derivedFrom:null,sourceReferences:[],designerValues:{},attachments:[],customerRef:'',siteRef:'',equipmentRef:'',templateId:'',templateSnapshot:null,findings:[],customSections:[],legacyImported:false,id:uid(),folio,title:d.title,template:Object.hasOwn(templates,template)?template:'general',status:'Borrador',revision:0,parentId:'',createdAt:now,updatedAt:now,serviceDate:localDate(),companyId:company?.id||'',companySnapshot:company?structuredClone(company):null,workOrder:'',technician:'',reviewer:'',customerCompany:'',customerName:'',customerEmail:'',customerPhone:'',customerId:'',customerRole:'',site:'',maintenanceType:d.defaultService,equipment:{equipmentType:'',brand:'',model:'',serial:'',assetTag:'',year:'',location:'',service:'',range:'',signal:'',supply:'',protocol:'',fuel:'Diésel',phase:'Trifásico',ratedPower:'',ratedVoltage:'',controller:'',engine:'',alternator:'',ats:''},schedule:{hourmeter:'',interval:'250',avgDailyHours:''},measurements:d.measurements.map(m=>({...m,id:uid()})),checklist:d.checklist.map(label=>({id:uid(),label,condition:'',notes:''})),objective:'',scope:'',exclusions:'',initialCondition:'',workPerformed:'',diagnosis:'',observations:'',recommendations:'',conclusions:'',materials:'',result:'No evaluado',photos:[],assets:[],actions:[],proposalItems:[],proposalTerms:'',proposalValidity:'30',proposalDeadline:'',taxRate:'19',clientSignature:'',technicianSignature:'',history:[{at:now,action:'Informe creado'}]};
}
export function normalizeReport(raw,company){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('Registro inválido');
 const type=Object.hasOwn(templates,raw.template)?raw.template:'generator',base=newReport(type,company,raw.folio||'');
 for(const [key,value] of Object.entries(base)){if(typeof value==='string'&&raw[key]!==undefined&&typeof raw[key]!=='string')throw new Error('Campo inválido en el informe: '+key);}
 const documentLayout=validateLayout(raw.documentLayout);
 const r={...base,...raw,documentLayout,schemaVersion:raw.schemaVersion||2,template:type,equipment:{...base.equipment,...raw.equipment},schedule:{...base.schedule,...raw.schedule}};
 for(const key of ['measurements','checklist','photos','assets','actions','proposalItems','history','findings','customSections','attachments','sourceReferences']) r[key]=Array.isArray(raw[key])?raw[key]:base[key];
 const shapes={measurements:{label:'',value:'',unit:'',reference:''},checklist:{label:'',condition:'',notes:''},photos:{dataUrl:'',caption:'',tag:''},assets:{tag:'',name:'',model:'',serial:'',notes:'',equipmentId:''},actions:{description:'',priority:'Media',owner:'',dueDate:'',status:'Pendiente'},proposalItems:{description:'',quantity:'1',unit:'un',price:'0'}};
 for(const [key,shape]of Object.entries(shapes))r[key]=r[key].map(item=>{if(!item||typeof item!=='object')throw new Error('Elemento inválido: '+key);const out={id:typeof item.id==='string'?item.id:uid()};for(const [field,fallback]of Object.entries(shape)){if(item[field]!==undefined&&typeof item[field]!=='string')throw new Error('Campo inválido: '+field);out[field]=item[field]??fallback;}return out;});
 for(const key of ['findings','customSections']){if(raw[key]!==undefined&&!Array.isArray(raw[key]))throw new Error('Lista inválida: '+key);if(r[key].length>(key==='findings'?150:20))throw new Error('Demasiados elementos: '+key);}
 r.findings=r.findings.map(f=>{if(!f||typeof f!=='object')throw new Error('Hallazgo inválido');const out={id:typeof f.id==='string'?f.id:uid()};for(const key of ['title','description','priority','recommendation','owner','dueDate','status','resolution','equipmentTag']){if(f[key]!==undefined&&typeof f[key]!=='string')throw new Error('Campo inválido en hallazgo');out[key]=f[key]??({priority:'Media',status:'Pendiente'}[key]||'');}if(f.photoIds!==undefined&&(!Array.isArray(f.photoIds)||f.photoIds.some(id=>typeof id!=='string')))throw new Error('Referencias de fotografía inválidas');out.photoIds=[...(f.photoIds||[])];return out;});
 r.customSections=r.customSections.map(s=>{if(!s||typeof s.id!=='string'||typeof s.title!=='string'||typeof s.content!=='string'||typeof s.required!=='boolean')throw new Error('Sección adicional inválida');return {id:s.id,title:s.title,content:s.content,required:s.required};});
 // Legacy documents marked Finalizado become immutable too.
 if(raw.status==='Finalizado'){r.status='Emitido';r.legacyImported=true;}
 if(!['Borrador','En revisión','Aprobado','Emitido'].includes(r.status))r.status='Borrador';
 r.id=typeof raw.id==='string'&&raw.id!=='unsaved'?raw.id:uid();
 r.companyId ||= company?.id||'';r.companySnapshot ||= company?structuredClone(company):null;
 r.revision=Number.isInteger(raw.revision)&&raw.revision>=0?raw.revision:0;
 return r;
}
export function inspectionResult(items){
 const evaluated=items.filter(i=>i.condition&&i.condition!=='No aplica');
 if(!evaluated.length)return 'No evaluado';
 if(evaluated.some(i=>i.condition==='No conforme'))return 'No conforme';
 if(evaluated.some(i=>i.condition==='Atención'))return 'Con observaciones';
 if(items.some(i=>!i.condition))return 'Inspección parcial';
 return 'Conforme';
}
export function validateReport(r){
 const errors=[...layoutIncomplete(r)];
 for(const [k,label] of [['folio','Folio'],['title','Título'],['serviceDate','Fecha'],['customerCompany','Empresa cliente'],['technician','Responsable'],['site','Ubicación'],['objective','Objetivo'],['scope','Alcance'],['conclusions','Conclusiones']])if(!String(r[k]||'').trim())errors.push(label);
 if(!r.companySnapshot?.name?.trim())errors.push('Datos de la empresa emisora');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.serviceDate||''))errors.push('Fecha válida');
 if(r.template==='proposal'){
  if(!r.proposalItems.length)errors.push('Partidas de la propuesta');
  if(r.proposalItems.some(i=>!i.description?.trim()||!(Number(i.quantity)>0)||!(Number(i.price)>=0)))errors.push('Cantidades y precios válidos');
 }else if(!r.workPerformed.trim())errors.push('Actividades / pruebas realizadas');
 if(r.checklist.some(i=>['Atención','No conforme'].includes(i.condition)&&!i.notes.trim()))errors.push('Observaciones de ítems con hallazgos');
 if(r.photos.some(p=>!p.caption.trim()))errors.push('Descripción de cada fotografía');
 if(r.result==='Conforme'&&inspectionResult(r.checklist)!=='Conforme')errors.push('Resultado coherente con la inspección');
 for(const f of r.findings||[]){if(!f.title?.trim()||!f.description?.trim()||!f.recommendation?.trim())errors.push('Título, evidencia y recomendación de cada hallazgo');if(f.photoIds?.some(id=>!r.photos.some(p=>p.id===id)))errors.push('Referencias fotográficas de hallazgos');if(['Alta','Crítica'].includes(f.priority)&&(!f.owner?.trim()||!f.dueDate))errors.push('Responsable y plazo de hallazgos de prioridad alta');if(f.status==='Resuelto'&&!f.resolution?.trim())errors.push('Evidencia de cierre de hallazgos resueltos');}
 const labels={workOrder:'OT / referencia',reviewer:'Revisor',customerEmail:'Correo del cliente',diagnosis:'Diagnóstico',recommendations:'Recomendaciones',initialCondition:'Condición inicial',materials:'Materiales',exclusions:'Exclusiones'};
 for(const key of r.templateSnapshot?.requiredFields||[])if(!String(r[key]||'').trim())errors.push(labels[key]||key);
 for(const section of r.customSections||[])if(section.required&&!section.content?.trim())errors.push(section.title);
 errors.push(...designerMissing(r));return [...new Set(errors)];
}
export function proposalTotals(r){const subtotal=r.proposalItems.reduce((sum,i)=>sum+(Number(i.quantity)||0)*(Number(i.price)||0),0);const rate=Math.min(100,Math.max(0,Number(r.taxRate)||0));const tax=subtotal*rate/100;return {subtotal,tax,total:subtotal+tax};}
export function money(value,currency='CLP'){try{return new Intl.NumberFormat('es-CL',{style:'currency',currency}).format(value);}catch{return `${value.toFixed(2)} ${currency}`;}}
export function nextService(r){const current=Number(r.schedule.hourmeter),interval=Number(r.schedule.interval),daily=Number(r.schedule.avgDailyHours);const hours=r.schedule.hourmeter!==''&&current>=0&&interval>0?current+interval:null;let date='';if(interval>0&&daily>0&&r.serviceDate){const d=new Date(r.serviceDate+'T12:00:00');d.setDate(d.getDate()+Math.ceil(interval/daily));date=fmtDate(localDate(d));}return {hours,date};}
export function reviseReport(r){const copy=structuredClone(r);copy.id=uid();copy.parentId=r.id;copy.revision=(r.revision||0)+1;copy.status='Borrador';copy.legacyImported=false;copy.createdAt=copy.updatedAt=new Date().toISOString();for(const key of ['createdBy','approvedBy','approvedAt','reviewedBy','reviewedAt','issuedBy','issuedAt'])copy[key]='';copy.clientSignature=copy.technicianSignature='';delete copy._sync;copy.history=[...(r.history||[]),{at:copy.createdAt,action:`Revisión ${copy.revision} creada desde ${r.folio}`}];return copy;}
export function dataForSync(row){const data=structuredClone(row);delete data._sync;return data;}
export function hasChangedDuringSync(current,sentMutation){return current?._sync?.mutationId!==sentMutation;}
