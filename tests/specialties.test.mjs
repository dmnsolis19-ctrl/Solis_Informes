import test from 'node:test';
import assert from 'node:assert/strict';
import {templates,newCompany,newReport} from '../public/js/domain.js';
import {filterTemplates} from '../public/js/specialties.js';
import {validateReportData} from '../worker/validation.js';
import {renderDocument} from '../public/js/render.js';
test('las cuatro especialidades pasan el contrato de servidor con valores sin evaluar',()=>{
 const company={...newCompany(),name:'Empresa multiespecialidad'};
 for(const key of ['hvac','electrical','automation','photovoltaic']){
  const r=newReport(key,company,'TEST-'+key);assert.ok(r.measurements.length);assert.ok(r.checklist.length);assert.ok(r.measurements.every(m=>m.value===''&&m.reference===''));assert.ok(r.checklist.every(c=>c.condition===''));assert.equal(r.result,'No evaluado');assert.equal(validateReportData(r).template,key);assert.ok(renderDocument(r,'').includes(templates[key].subtitle));
  const other=newReport(key,company);r.checklist[0].notes='Solo este informe';assert.equal(other.checklist[0].notes,'');
 }
});
test('búsqueda por servicio y especialidad respeta acentos y no restringe plantillas futuras',()=>{
 const entries=Object.entries(templates);assert.ok(filterTemplates(entries,'CLIMATIZACION').some(([key])=>key==='hvac'));assert.ok(filterTemplates(entries,'FAT','automation').some(([key])=>key==='automation'));assert.equal(filterTemplates(entries,'fotovoltaico','hvac').length,0);
 const future=[['future',{label:'Ensayo de vibraciones',description:'Servicio nuevo',serviceOptions:['Análisis de vibraciones']}]];assert.equal(filterTemplates(future,'vibraciones','general').length,1);
});
