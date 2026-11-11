import {enterpriseRoute} from './enterprise.js';
import {getUser,createSession,cookie,rateLimit,sha256,randomToken,hashPassword,constantEqual} from './auth.js';
import {HttpError,fail,jsonBody} from './validation.js';
import {verificationPage} from './integrity.js';
import {runScheduled} from './scheduled.js';
import {securityRoute} from './security.js';
import {checkSecondFactor} from './totp.js';
import {escapeHtml as e} from '../public/js/domain.js';
import {baseHeaders,securityHeaders,json,dto,entity} from './http.js';
import {embedAssets} from './files.js';
import {reportHtml,pdfResponse,publicShare,documentRoutes} from './documents.js';
import {aiRoute} from './ai.js';
import {syncRoute} from './sync-routes.js';
function originCheck(req){const origin=req.headers.get('Origin');if(origin&&origin!==new URL(req.url).origin)fail(403,'Origen no autorizado.');if(req.method!=='GET'&&req.method!=='HEAD'&&!['2','3','4','5','6'].includes(req.headers.get('X-Solis-Client')))fail(403,'Solicitud no autorizada.');}
async function route(req,env,ctx){
 const url=new URL(req.url),path=url.pathname;
 if(path.startsWith('/s/'))return publicShare(req,env,url);
 if(path.startsWith('/v/')){const match=path.match(/^\/v\/([a-f0-9]{32})\/?$/);if(!match)return new Response('Código no válido',{status:404,headers:baseHeaders});if(!env.DB)return new Response('Servicio no configurado',{status:503,headers:baseHeaders});if(!(await rateLimit(env,'verify:'+req.headers.get('CF-Connecting-IP'),60)))return new Response('Demasiadas solicitudes. Intenta más tarde.',{status:429,headers:baseHeaders});return verificationPage(env,match[1]);}
 if(!path.startsWith('/api/')){const asset=await env.ASSETS.fetch(req);const headers=new Headers(asset.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');for(const [name,value]of Object.entries(securityHeaders))headers.set(name,value);headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");if(path==='/sw.js'||path==='/'||path.endsWith('.html'))headers.set('Cache-Control','no-cache');return new Response(asset.body,{status:asset.status,headers});}
 originCheck(req);
 if(path==='/api/status'&&req.method==='GET'){const user=await getUser(req,env);return json({version:'3.10.0',configured:!!env.DB&&!!env.BUCKET,user,capabilities:{ai:!!env.AI,pdf:!!env.BROWSER,email:!!env.RESEND_API_KEY&&!!env.EMAIL_FROM,transcription:!!env.AI,portal:true,workflow:true}});}
 if(!env.DB||!env.BUCKET)fail(503,'Configura las conexiones DB y BUCKET en Cloudflare. El modo local sigue disponible.');
 if(['/api/setup','/api/login'].includes(path)&&req.method==='POST'){
  const b=await jsonBody(req,5000),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length>128)fail(400,'Correo o contraseña inválidos.');
  if(!(await rateLimit(env,'auth:'+req.headers.get('CF-Connecting-IP')+':'+email,12)))fail(429,'Demasiados intentos. Espera antes de volver a intentar.');
  if(path==='/api/setup'){
   if(!env.SETUP_TOKEN||env.SETUP_TOKEN.length<20||!constantEqual(await sha256(String(b.setupToken||'')),await sha256(env.SETUP_TOKEN)))fail(403,'Código de instalación incorrecto o sin configurar.');
   if(password.length<12)fail(400,'Usa una contraseña de al menos 12 caracteres.');
   const workspaceId=crypto.randomUUID(),userId=crypto.randomUUID(),salt=randomToken(),hash=await hashPassword(password,salt),at=new Date().toISOString();
   const results=await env.DB.batch([env.DB.prepare('INSERT INTO workspaces(id,name,created_at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM users)').bind(workspaceId,'Mi espacio',at),env.DB.prepare("INSERT INTO users(id,workspace_id,email,password_hash,salt,role,created_at) SELECT ?,?,?,?,?, 'admin',? WHERE NOT EXISTS(SELECT 1 FROM users)").bind(userId,workspaceId,email,hash,salt,at)]);
   if(!results[1].meta.changes)fail(409,'El administrador ya fue creado. Usa el inicio de sesión.');
   return json({ok:true},201,{'Set-Cookie':await createSession(userId,env,req.url)});
  }
  const user=await env.DB.prepare('SELECT * FROM users WHERE email=? AND active=1').bind(email).first();const calculated=await hashPassword(password,user?.salt||'missing-user-constant-salt');if(!user||!constantEqual(calculated,user.password_hash))fail(401,'Correo o contraseña incorrectos.');if(user.totp_enabled){const second=await checkSecondFactor(env,user,b.code,{rateLimit});if(!second.ok)fail(401,second.message,{needsCode:true});}return json({ok:true},200,{'Set-Cookie':await createSession(user.id,env,req.url)});
 }
 const user=await getUser(req,env);if(!user)fail(401,'Inicia sesión para acceder al servidor.');
 if(path==='/api/logout'&&req.method==='POST'){const token=req.headers.get('Cookie')?.match(/solis_session=([A-Za-z0-9_-]{43})/)?.[1];if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();return json({ok:true},200,{'Set-Cookie':cookie('',req.url,true)});}
 const security=await securityRoute(req,env,user,url,{json});if(security)return security;
 const extension=await enterpriseRoute(req,env,user,url,{json,entity,dto,embedAssets,reportHtml,pdfResponse});if(extension)return extension;
 const sync=await syncRoute(req,env,user,url);if(sync)return sync;
 const documents=await documentRoutes(req,env,user,url);if(documents)return documents;
 const ai=await aiRoute(req,env,user,url);if(ai)return ai;
 fail(404,'Ruta no encontrada.');
}
export default {async fetch(req,env,ctx){try{return await route(req,env,ctx);}catch(error){if(error instanceof HttpError)return json({error:error.message,...error.extra},error.status);console.error('Request failed',error.name,error.message);return json({error:'No se pudo completar la operación. Tus cambios locales se conservan.'},500);}},async scheduled(event,env,ctx){if(!env.DB)return;ctx.waitUntil(runScheduled(env));}};
