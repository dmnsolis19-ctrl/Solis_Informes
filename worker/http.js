// Cabeceras y ayudantes de respuesta compartidos por las rutas del Worker.
export const securityHeaders={'Strict-Transport-Security':'max-age=31536000','Permissions-Policy':'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()'};
export const baseHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',...securityHeaders};
export const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{...baseHeaders,...headers}});
export const dto=row=>({id:row.id,kind:row.kind,version:row.version,deleted:!!row.deleted,data:JSON.parse(row.data)});
export async function entity(env,user,kind,id){return env.DB.prepare('SELECT * FROM entities WHERE workspace_id=? AND kind=? AND id=?').bind(user.workspaceId,kind,id).first();}
export const defaultAiModel='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
