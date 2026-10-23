import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const commands=[['scripts/check.mjs'],['--test',...readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f)],['scripts/build.mjs']];
for(const args of commands){const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
