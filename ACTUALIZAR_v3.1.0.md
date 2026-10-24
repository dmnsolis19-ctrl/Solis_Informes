# Actualizar a SOLIS Field Pro 3.1.0

1. Descarga un respaldo desde cada dispositivo y exporta D1 antes de actualizar.
2. Descomprime el ZIP y copia el contenido en la raíz del repositorio GitHub, reemplazando los archivos correspondientes.
3. Conserva tu `wrangler.jsonc` de producción, el nombre `solis-informes`, el ID actual de D1, el bucket R2 y los bindings `DB`, `BUCKET`, `AI` y `BROWSER`. No recrees recursos.
4. No elimines migraciones existentes. Esta versión no requiere una migración nueva de D1.
5. Mantén los comandos de Cloudflare: `node scripts/ci.mjs` y `node scripts/deploy.mjs`, Node.js 24.
6. Haz commit a la rama conectada. Espera a que compile y despliegue.
7. Abre la misma URL de producción y confirma que el pie muestre Field Pro · v3.1.0. Si la app estaba abierta, guarda el trabajo y recarga para aplicar la actualización del service worker.
8. Abre «Configuración y diagnóstico» y revisa las recomendaciones. Los estados locales no garantizan que un proveedor remoto esté disponible; inicia sesión para probar los servicios reales.
9. En un borrador con fotografías, usa «Marcar evidencia». Se agrega una copia anotada y la foto original no se modifica.

## Nota de configuración
La pantalla de diagnóstico no lee valores secretos ni prueba servicios remotos de forma automática. Comprueba bindings/secrets en Cloudflare y ejecuta las pruebas de IA/PDF desde la aplicación autenticada. Para correo se requieren `RESEND_API_KEY` y `EMAIL_FROM`; no agregues claves al repositorio.
