import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(config.d1_databases?.some(d=>!d.database_id||d.database_id.includes('REEMPLAZAR'))){console.error('Primero crea D1 y reemplaza database_id en wrangler.jsonc. Consulta docs/GITHUB_CLOUDFLARE.md.');process.exit(1);}
const npx=process.platform==='win32'?'npx.cmd':'npx';
for(const args of [['wrangler@4.92.0','d1','migrations','apply','solis-field','--remote'],['wrangler@4.92.0','deploy']]){const result=spawnSync(npx,args,{stdio:'inherit',shell:process.platform==='win32'});if(result.status!==0)process.exit(result.status||1);}
