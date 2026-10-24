# Actualizar a SOLIS Field Pro 3.0.0

Esta entrega amplía tu aplicación existente en `Solis_Informes`. No necesita otro Worker, otra D1 ni otro bucket.

1. Descarga un respaldo en cada dispositivo con trabajo local pendiente. Conserva también un respaldo/exportación de D1 antes de la migración.
2. Extrae el ZIP y copia su contenido en la raíz del repositorio, reemplazando las fuentes. Deben quedar `package.json`, `public/`, `worker/`, `scripts/` y `migrations/` directamente en la raíz.
3. **Conserva tu `wrangler.jsonc` actual.** El paquete excluye ese archivo. El nombre confirmado es `solis-informes`: conserva también tu ID D1, bucket R2 y bindings DB, BUCKET, AI y BROWSER. El archivo `wrangler.example.jsonc` es solo para instalaciones nuevas.
4. Sube `migrations/0003_enterprise.sql` y conserva 0001 y 0002. No recrees los recursos. El script aplicará únicamente las migraciones pendientes.
5. Mantén en Cloudflare estos comandos:

   | Configuración | Comando |
   |---|---|
   | Compilación | `node scripts/ci.mjs` |
   | Despliegue | `node scripts/deploy.mjs` |
   | Node.js | `24` |

6. Confirma el commit en la rama conectada a Cloudflare. Espera que finalicen las pruebas, migración y publicación.
7. Abre la misma dirección con internet. Guarda y cierra los formularios; cierra y vuelve a abrir la aplicación si espera la actualización. Comprueba «Field Pro · v3.0.0».
8. Actualiza todos los dispositivos. Una versión anterior no puede escribir sobre documentos nuevos si pudiera perder sus campos.
9. Entra como administrador y abre «Equipo y servicios». Revisa los permisos por empresa de las cuentas existentes. Los usuarios anteriores conservan acceso a todas las empresas de su organización hasta que lo limites.
10. Completa las pruebas de nube descritas en `docs/VERIFICACION.md` antes de entregar documentación a clientes.

## Servicios opcionales

Tu configuración existente con AI y BROWSER sirve como punto de partida. «Equipo y servicios» indica qué bindings detecta el servidor; ese estado no prueba cuota, permisos del proveedor o calidad de salida.

| Función | Configuración |
|---|---|
| Redacción y consultas con IA | Binding `AI`; variable `AI_MODEL` existente |
| Audio a texto | Binding `AI`; modelo predeterminado `@cf/openai/whisper-large-v3-turbo`; opcional `TRANSCRIPTION_MODEL` compatible |
| PDF a texto | Binding `AI` con `toMarkdown`; también se puede importar TXT/Markdown o pegar texto |
| PDF directo | Binding `BROWSER` y compatibilidad de tu Worker actual |
| Correo desde plataforma | Secret `RESEND_API_KEY` y remitente verificado `EMAIL_FROM` |
| Portal, roles y aprobación | DB, BUCKET y migración 0003; no requieren proveedor de IA |

No publiques claves ni contraseñas en GitHub. No necesitas crear otro administrador inicial si ya existe. Consulta `docs/USO_V3.md` para configurar las nuevas funciones.

## Si algo falla

Conserva el registro completo. No cambies IDs de recursos para solucionar errores. Un fallo antes de terminar la migración requiere revisar su causa antes de reintentar; no borres las tablas ni retires las migraciones. Si el Worker anterior sigue activo después de aplicar 0003, puede seguir leyendo los tipos anteriores; actualiza la aplicación antes de editar documentos de la versión 3.
