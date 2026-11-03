# Actualizar de 3.5.x a SOLIS Field Pro 3.6.0

Esta entrega parte del repositorio 3.5.1 e incluye el proyecto completo. Hay **una migración nueva (0004)**: solo agrega tablas y columnas, no modifica tus datos.

1. Guarda los formularios y descarga un respaldo de cada dispositivo con cambios pendientes.
2. Reemplaza el contenido del repositorio conectado a Cloudflare por el de este ZIP. El `wrangler.jsonc` incluido conserva tus identificadores de D1/R2 y cambia solo dos valores: la hora de la tarea diaria (`0 11 * * *`, unas 07:00–08:00 en Chile) y el modelo de IA (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`). Si prefieres el modelo anterior, vuelve a poner `@cf/meta/llama-3.1-8b-instruct` en `AI_MODEL`.
3. **Secreto recomendado:** crea `APP_SECRET` (texto aleatorio de 32 caracteres o más) en Cloudflare → tu Worker → Configuración → Variables y secretos. Cifra el secreto de la verificación en dos pasos. Si no existe se usa `SETUP_TOKEN`; si cambias cualquiera de los dos después de activar el segundo paso, cada usuario debe desactivarlo y volver a activarlo.
4. Variables opcionales (todas pueden omitirse):
   - `APP_URL`: dirección de la aplicación, para el enlace del resumen diario.
   - `TIMEZONE`: zona horaria de los avisos (por defecto `America/Santiago`).
   - `DIGEST_ENABLED=false`: desactiva el resumen diario por correo (necesita `RESEND_API_KEY` y `EMAIL_FROM` para funcionar).
   - `BACKUP_KEEP_DAYS`: días de respaldo que se conservan (por defecto 14, máximo 90).
   - Enlace de R2 `BACKUP_BUCKET`: un segundo bucket (idealmente en otra cuenta o región) para los respaldos. Sin él se usa `solis-field-files` bajo `backups/`.
5. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs`; aplica la migración 0004 y luego publica. Usa Node.js 24.
6. Cuando termine el despliegue, abre la aplicación con conexión, cierra y vuelve a abrir para activar la actualización. Comprueba `Field Pro · v3.6.0`. Actualiza todas las pestañas y dispositivos: las versiones anteriores no pueden editar informes que ya tengan gráficos, fecha de firma o datos de fotografía.
7. Activa la **verificación en dos pasos** para el administrador y los aprobadores: Sincronización → Verificación en dos pasos.

## Gráficos y datos de energía

En un borrador, pestaña **Mediciones → Gráficos y tendencias**.

- **Tendencia del equipo:** el informe debe estar vinculado a un equipo del catálogo. Se grafican las lecturas del mismo parámetro y unidad de sus informes vigentes y las de este informe. Cada gráfico guarda sus puntos: el documento emitido no cambia aunque después se editen otros informes.
- **Importar datos (CSV):** archivo de hasta 5 MB con fecha y hora y una o más columnas numéricas. Acepta `,`, `;` o tabulación, coma o punto decimal, fechas ISO o `dd/mm/aaaa`, y fecha y hora en columnas separadas. Indica la zona horaria de los datos; las columnas en kW o W calculan además la energía por integración (se ignoran huecos de más de 2 horas). Las series largas se reducen a 240 puntos conservando su forma.
- Hasta 12 gráficos por informe. Aparecen en «Mediciones y pruebas».

## Verificación del documento

Al emitir, el servidor calcula una huella SHA-256 del documento y registra un código. El PDF, la vista de impresión y el enlace compartido incluyen un QR hacia `/v/<código>`. La página pública indica el emisor, folio, revisión y fecha, y uno de estos resultados: vigente e íntegro, reemplazado por una revisión posterior, archivado, o **el registro no coincide con la huella emitida**. No muestra el contenido ni al cliente.

Alcance: verifica el registro emitido en tu servidor, no los bytes de un PDF descargado. Quien reciba un PDF debe comparar su folio y revisión con los de la página.

La firma del cliente registra la fecha y hora en que se dibujó y se muestra bajo la firma.

## Fotografías y dictado

- En Evidencias, elige si cada fotografía guarda su fecha y hora (activado por defecto) y su ubicación aproximada (desactivado; el navegador pide permiso). Se muestran bajo la fotografía en el documento. La preferencia queda en ese dispositivo.
- El botón **Dictar** de los campos de texto usa el reconocimiento de voz del navegador (Chrome y Android). Según el navegador, el audio puede procesarse en los servidores de su proveedor: no dictes datos confidenciales si eso no es aceptable para tu organización.

## Verificación en dos pasos

Sincronización → Verificación en dos pasos → Comenzar. Escanea el QR con Google Authenticator, Microsoft Authenticator, Aegis u otra aplicación TOTP, escribe el código y guarda los 8 códigos de recuperación (se muestran una sola vez). Al iniciar sesión se pide el código; un mismo código no sirve dos veces y hay un límite de intentos. Para desactivarla se piden la contraseña y un código. Si un usuario pierde su teléfono y sus códigos, un administrador con acceso a la base D1 puede restablecerlo: `UPDATE users SET totp_enabled=0, totp_secret='' WHERE email='…'`.

## Tarea diaria

Cada día a las 11:00 UTC:

- Borra sesiones y límites vencidos, y las copias de enlaces compartidos caducados o revocados hace más de 30 días.
- **Respaldo:** guarda en R2 `backups/AAAA-MM-DD/<espacio>/` un JSON por tipo de registro, la lista de usuarios (sin contraseñas ni secretos) y un `manifest.json`. Conserva 14 días. Las fotografías y archivos viven en R2 bajo el espacio de trabajo y **no se copian**; para protegerlos activa también la réplica o el versionado que ofrezca tu cuenta de Cloudflare. D1 además ofrece Time Travel.
- **Resumen por correo:** una vez al día por usuario con alertas, órdenes y mantenimientos próximos o vencidos, y enlaces propios que vencen en 3 días. Solo se envía si hay algo que avisar.

## Errores de los dispositivos

Los dispositivos con sesión iniciada envían al servidor los fallos inesperados de la aplicación (mensaje, versión y navegador; sin contenido de informes). El administrador los ve en Sincronización → Errores de dispositivos. Se conservan 30 días y un máximo de 500.

## Plantillas nuevas

Plantillas → filtro por especialidad: FAT y SAT de PLC/SCADA (Automatización), planta de tratamiento de agua (Agua y procesos), almacenamiento con baterías y gestión de energía, y tableros con termografía (Electricidad y energía). Traen verificaciones y mediciones sugeridas; las lecturas y los criterios de aceptación los define el responsable.

Consulta `docs/releases/REVISION_3.6.0.md` para las pruebas realizadas y la validación pendiente en tu entorno Cloudflare.
