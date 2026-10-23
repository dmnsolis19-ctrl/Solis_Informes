import http from 'node:http';
import path from 'node:path';
import worker from '../worker/index.js';
import {makeEnvironment,root} from './local-bindings.mjs';
const env=makeEnvironment({directory:path.join(root,'.local-data')});const port=Number(process.env.PORT||4173);
const server=http.createServer(async(req,res)=>{try{const origin=`http://${req.headers.host}`;const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>12000000){res.writeHead(413);res.end('Too large');return;}chunks.push(chunk);}const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});const response=await worker.fetch(request,env,{waitUntil:p=>p.catch(console.error)});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){console.error(error.message);res.writeHead(500);res.end('Server error');}});
server.listen(port,'0.0.0.0',()=>{console.log(`SOLIS Field Pro · http://localhost:${port}`);console.log('Modo local de pruebas. Primer acceso: código solis-local-installation-2026.');console.log('Sin credenciales de producción. Datos de prueba en .local-data/ (excluidos de Git).');});
