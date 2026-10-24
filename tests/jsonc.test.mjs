import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJsonc} from '../scripts/jsonc.mjs';
test('configuración acepta comentarios y comas finales conservando URLs y cadenas',()=>{
 const value=parseJsonc(`{ // config\n "name":"solis-informes", /* bindings */ "url":"https://example.test/a//b", "literal":"/* texto */", "values":[1,2,],}`);
 assert.equal(value.name,'solis-informes');assert.equal(value.url,'https://example.test/a//b');assert.equal(value.literal,'/* texto */');assert.deepEqual(value.values,[1,2]);
});
test('configuración conserva comillas escapadas y rechaza contenido inválido',()=>{
 assert.deepEqual(parseJsonc(JSON.stringify({value:'comilla " y barra \\',tail:'texto,}'})),{value:'comilla " y barra \\',tail:'texto,}'});
 assert.throws(()=>parseJsonc('{/* abierto'),SyntaxError);assert.throws(()=>parseJsonc('{"name": invalid}'),SyntaxError);
});
