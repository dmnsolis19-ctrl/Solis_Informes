# Actualizar SOLIS Field Pro a 2.1.0

Este paquete actualiza la aplicación que ya tienes en GitHub y Cloudflare. No crea una aplicación ni una base de datos nuevas.

1. En la aplicación actual, descarga un respaldo desde «Descargar respaldo». Hazlo en cada dispositivo que conserve cambios sin sincronizar.
2. Extrae este ZIP y copia su contenido en la raíz de tu repositorio `Solis_Informes`, reemplazando los archivos del proyecto. En GitHub deben seguir apareciendo `package.json`, `public/`, `worker/`, `scripts/` y `migrations/` directamente en la raíz.
3. **Conserva tu `wrangler.jsonc` actual.** El ZIP no lo incluye para evitar reemplazar el nombre válido del Worker, el identificador D1 o las conexiones R2/AI/BROWSER que ya configuraste. `wrangler.example.jsonc` sirve únicamente para una instalación nueva; no sustituye tu archivo actual.
   Al revisar tu repositorio, el campo `name` todavía aparece como `solis_informes`. Debe coincidir con el nombre válido del Worker que ya tienes publicado en Cloudflare, usando minúsculas, números y guiones. Si publicaste el Worker como `solis-informes`, cambia únicamente esa línea a `"name": "solis-informes"`. No cambies el ID de D1, los nombres de recursos ni los bindings.
4. Sube también `migrations/0002_catalogs.sql`; conserva `0001_initial.sql` y todas las demás migraciones existentes. No borres ni recrees D1 o R2.
5. Realiza el commit en la rama conectada a Cloudflare. Mantén estos comandos:
   - Compilación: `node scripts/ci.mjs`
   - Despliegue: `node scripts/deploy.mjs`
6. El despliegue aplicará las migraciones D1 pendientes antes de publicar el Worker. La nueva migración conserva informes, identificadores, revisiones e historial y habilita los catálogos.
7. Abre la misma dirección de la aplicación con internet. Guarda y cierra cualquier formulario de configuración. Vuelve a abrir la aplicación si la actualización quedó esperando y verifica «Field Pro · v2.1.0» en el menú lateral.
8. Actualiza todos tus dispositivos antes de editar informes que ya tengan catálogos, hallazgos o plantillas propias. La versión anterior recibe un aviso de actualización al intentar sobrescribir esos documentos.

Si el despliegue falla, conserva el registro completo del error. No cambies los identificadores de recursos para solucionarlo. El script detecta un nombre de Worker inválido antes de ejecutar la migración.

## Primer recorrido recomendado

1. En «Clientes e instalaciones», registra un cliente y su instalación.
2. En «Equipos e historial», registra el activo con un TAG único dentro de la empresa.
3. En «Plantillas», crea una plantilla propia: elige su base, ordena las secciones, marca los campos adicionales obligatorios y agrega secciones de tu procedimiento.
4. Abre el historial del equipo, selecciona tu plantilla y crea el informe. El cliente, la instalación y el equipo se completan automáticamente.
5. Completa la redacción, agrega fotografías y registra los hallazgos. En «Hallazgos», vincula las figuras correspondientes y define prioridad, responsable, plazo y estado.
6. Revisa la vista previa y emite el documento cuando corresponda. Para cambios posteriores, crea una revisión.

## Alcance de esta versión

- Los catálogos y las plantillas se guardan offline y se sincronizan con la sesión activa, conexión y la aplicación abierta. No se promete sincronización con la aplicación completamente cerrada.
- Cada informe conserva la copia de los datos y de la plantilla usada al crearlo. Los cambios del catálogo no reescriben documentos anteriores.
- Archivar un registro lo retira de la selección habitual. Se restaura desde «Ver archivados». Los informes y sus relaciones históricas se conservan. Restaura los padres archivados si necesitas seleccionar de nuevo un equipo o instalación dependiente.
- Los informes antiguos no se enlazan automáticamente por coincidencias de nombre o TAG. Vincula los borradores existentes desde el editor. Para emitidos, crea una revisión y selecciona el activo.
- Los respaldos nuevos incluyen los catálogos, plantillas y registros archivados, además de informes, firmas e imágenes. Importar agrega IDs nuevos y conserva los existentes; no sobrescribe una versión posterior ya guardada.
- Un hallazgo de prioridad Alta o Crítica necesita responsable y fecha para emitir. Un hallazgo Resuelto necesita texto de evidencia de cierre. La fotografía se cita por su ID y su número de figura actual.
- La IA recibe también los hallazgos registrados para proponer redacción revisable. IA, correo, PDF de servidor y envío de enlaces requieren internet y la configuración correspondiente. El PDF mediante impresión sigue disponible offline cuando la aplicación esté preparada.
- El envío por WhatsApp mantiene el mecanismo de compartir del dispositivo o el enlace del documento emitido; no se incorporó un servicio de mensajería automática.

Consulta `docs/VERIFICACION.md` para las pruebas realizadas y las comprobaciones pendientes en tu nube.
