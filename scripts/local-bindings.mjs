import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {readFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function sqliteBinding(filename=':memory:'){
 const database=new DatabaseSync(filename);database.exec('PRAGMA foreign_keys=ON');
 const make=(sql,args=[])=>({sql,args,bind(...values){return make(sql,values);},async first(){return database.prepare(sql).get(...args)||null;},async all(){return {results:database.prepare(sql).all(...args)};},async run(){const result=database.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}});
 return {prepare:sql=>make(sql),async batch(statements){database.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements)results.push(await s.run());database.exec('COMMIT');return results;}catch(error){database.exec('ROLLBACK');throw error;}},migrationApplied:name=>!!database.prepare('SELECT name FROM local_migrations WHERE name=?').get(name),exec:sql=>database.exec(sql),close:()=>database.close()};
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
export function assetBinding(){return {async fetch(request){const pathname=decodeURIComponent(new URL(request.url).pathname),relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(root,'public',relative);if(!file.startsWith(path.join(root,'public')+path.sep))return new Response('Not found',{status:404});try{const data=await readFile(file);return new Response(data,{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}};}
export function memoryBucket(){const objects=new Map();return {async put(key,value,opts={}){const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);objects.set(key,{bytes,httpMetadata:opts.httpMetadata||{}});},async head(key){return objects.has(key)?objects.get(key):null;},async get(key){const o=objects.get(key);if(!o)return null;return {body:o.bytes,httpMetadata:o.httpMetadata,async arrayBuffer(){return o.bytes.buffer.slice(o.bytes.byteOffset,o.bytes.byteOffset+o.bytes.byteLength);},async json(){return JSON.parse(new TextDecoder().decode(o.bytes));}};},async delete(key){objects.delete(key);}};}
function fileBucket(directory){return {async put(key,value,opts={}){const file=path.join(directory,key);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,value);await writeFile(file+'.meta',JSON.stringify(opts.httpMetadata||{}));},async head(key){try{await stat(path.join(directory,key));return {};}catch{return null;}},async get(key){try{const file=path.join(directory,key),bytes=await readFile(file),metadata=JSON.parse(await readFile(file+'.meta','utf8'));return {body:bytes,httpMetadata:metadata,async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);},async json(){return JSON.parse(bytes.toString('utf8'));}};}catch{return null;}},async delete(key){const {unlink}=await import('node:fs/promises');await unlink(path.join(directory,key)).catch(()=>{});}};}
export function makeEnvironment({directory=null}={}){
 if(directory)mkdirSync(directory,{recursive:true});const filename=directory?path.join(directory,'dev.sqlite'):':memory:',fresh=!directory||!existsSync(filename),DB=sqliteBinding(filename);
 DB.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
 for(const name of readdirSync(path.join(root,'migrations')).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
  // Existing developer databases already contain the original schema.
  if(!fresh&&name==='0001_initial.sql'){DB.exec(`INSERT OR IGNORE INTO local_migrations VALUES('${name}')`);continue;}
  // The synchronous adapter exposes a migration runner to avoid async startup.
  if(!DB.migrationApplied(name)){DB.exec('BEGIN IMMEDIATE');try{DB.exec(readFileSync(path.join(root,'migrations',name),'utf8'));DB.exec(`INSERT INTO local_migrations VALUES('${name}')`);DB.exec('COMMIT');}catch(error){DB.exec('ROLLBACK');throw error;}}
 }
 return {DB,BUCKET:directory?fileBucket(path.join(directory,'objects')):memoryBucket(),ASSETS:assetBinding(),SETUP_TOKEN:process.env.SETUP_TOKEN||'solis-local-installation-2026'};
}
