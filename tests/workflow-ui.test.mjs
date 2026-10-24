import test from 'node:test';
import assert from 'node:assert/strict';
import {newCompany,newReport} from '../public/js/domain.js';
import {workflowSummary} from '../public/js/workflow-ui.js';
test('el recorrido documental explica el estado y abre los controles existentes',()=>{
 const company={...newCompany(),name:'Empresa'};
 for(const template of ['general','hvac','electrical','automation','photovoltaic']){
  const report=newReport(template,company,'FLOW-1');const draft=workflowSummary(report);assert.match(draft,/puntos de contenido por completar/);assert.match(draft,/data-action="tab"/);assert.doesNotMatch(draft,/data-action="lifecycle"/);
  report.status='En revisión';assert.match(workflowSummary(report),/validan en el servidor/);
  report.status='Emitido';const issued=workflowSummary(report);assert.match(issued,/data-action="share"/);assert.equal((issued.match(/aria-current="step"/g)||[]).length,1);
 }
});
