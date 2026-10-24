import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../public/js/app.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
test('la interfaz incluye diagnóstico de servicios y guía de configuración',()=>{
 assert.match(app,/function diagnosticsView\(\)/);
 assert.match(app,/navItem\('diagnostics','Configuración y diagnóstico'/);
 assert.match(app,/RESEND_API_KEY/);
 assert.match(app,/Binding esperado: DB/);
});
test('el editor fotográfico crea una copia y conserva el original',()=>{
 assert.match(app,/data-action="photo-annotate"/);
 assert.match(app,/Copia anotada de la evidencia/);
 assert.match(app,/Original conservado sin cambios/);
});
test('los controles de anotación tienen estilos adaptables',()=>{
 assert.match(css,/\.annotation-canvas-wrap/);
 assert.match(css,/@media\(max-width:700px\)/);
});
