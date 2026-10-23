import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));let count=0;
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(['dist','node_modules','.local-data','.wrangler'].includes(e.name))continue;const file=path.join(dir,e.name);if(e.isDirectory())await walk(file);else if(/\.(js|mjs)$/.test(file)){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stderr);process.exitCode=1;}count++;}}}
await walk(root);console.log(`Sintaxis revisada: ${count} módulos.`);
