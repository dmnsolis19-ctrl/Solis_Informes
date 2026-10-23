> Si ya tienes la aplicación publicada, utiliza primero `ACTUALIZAR_v2.1.0.md` y conserva tu `wrangler.jsonc`. Las instrucciones siguientes corresponden a una instalación nueva. En una instalación nueva, comienza copiando `wrangler.example.jsonc` como `wrangler.jsonc`.

# Publicar desde GitHub en Cloudflare

Esta entrega está preparada para **Cloudflare Workers con Static Assets**, D1 y R2. No uses el asistente de Cloudflare Pages ni un preset de Next.js para esta versión.

## 1. Antes de actualizar

1. En tu aplicación actual, presiona **Descargar respaldo**.
2. Conserva ese JSON fuera de la carpeta del proyecto.
3. Descomprime el nuevo ZIP en una carpeta nueva.
4. Sube a GitHub el **contenido del proyecto**: `package.json`, `wrangler.jsonc`, `public`, `worker`, `scripts`, `migrations`, `tests` y `docs`. Estos archivos deben quedar en la raíz seleccionada del repositorio, no dentro de otra carpeta por accidente.
5. Para sustituir el proyecto anterior, reemplaza sus fuentes con esta entrega. Conserva la carpeta `.git` si utilizas Git local y no copies datos de `.local-data`, credenciales ni archivos `.dev.vars`.

No basta con copiar la carpeta `public` sobre el proyecto anterior. Esta versión tiene una arquitectura y servidor diferentes.

## 2. Crear el almacenamiento

En tu cuenta de Cloudflare:

- Crea una base D1 llamada `solis-field`.
- Copia su **Database ID**.
- Crea un bucket R2 llamado `solis-field-files`. Mantén desactivado el acceso público del bucket.
- En GitHub, edita `wrangler.jsonc` y sustituye `REEMPLAZAR_CON_ID_D1` por el ID real.

Si prefieres la terminal, con tu propia sesión de Cloudflare:

```bash
npx wrangler@4.92.0 login
npx wrangler@4.92.0 d1 create solis-field
npx wrangler@4.92.0 r2 bucket create solis-field-files
```

No crees otra base si ya has realizado estos pasos. Si utilizas nombres distintos, actualiza los nombres en `wrangler.jsonc` y en `scripts/deploy.mjs`.

## 3. Conectar GitHub a tu Worker

Para conservar tu dirección actual, abre el Worker **solis-mantenimiento-grupos** en Cloudflare:

1. Ve a **Settings → Builds → Connect** y conecta el repositorio GitHub.
2. Selecciona la rama que usarás, normalmente `main`.
3. Configura la raíz donde están `package.json` y `wrangler.jsonc`.
4. Selecciona Node.js 24 en el entorno de compilación (`NODE_VERSION=24`).
5. Usa los siguientes comandos:

| Configuración | Valor |
|---|---|
| Build command | `node scripts/ci.mjs` |
| Deploy command | `node scripts/deploy.mjs` |
| Rama de producción | `main` |
| Directorio raíz | La carpeta que contiene `wrangler.jsonc` |

El script de compilación comprueba la sintaxis, ejecuta las pruebas y prepara la caché offline. El de despliegue aplica las migraciones D1 pendientes y luego publica el Worker.

**El nombre del Worker debe coincidir con `name` en `wrangler.jsonc`.** Actualmente está configurado como `solis-mantenimiento-grupos`, que corresponde al enlace original. Si creas otro Worker, modifica ese campo.

La identidad y permisos de compilación necesitan acceso a Workers, D1 y R2 en tu cuenta. Si la migración indica falta de permisos, revisa el token de Builds o aplica una sola vez la migración desde tu propia terminal:

```bash
npx wrangler@4.92.0 d1 migrations apply solis-field --remote
```

No publiques secretos ni tokens en GitHub. Los permisos de tu cuenta y la creación de recursos deben realizarlos tú en Cloudflare.

## 4. Configurar conexiones y servicios

`wrangler.jsonc` declara estas conexiones:

| Nombre | Tipo | Función |
|---|---|---|
| `ASSETS` | Static Assets | Interfaz web y archivos offline |
| `DB` | D1 | Usuarios, empresas, informes e historial |
| `BUCKET` | R2 | Evidencias y copias de informes compartidos |
| `AI` | Workers AI | Asistente de redacción |
| `BROWSER` | Browser Run | PDF directo con numeración |

Comprueba que tu cuenta tiene habilitados R2 y los servicios que utilizarás. Si todavía no quieres habilitar IA o PDF directo, puedes quitar temporalmente sus bloques `ai` y `browser` de `wrangler.jsonc`. El guardado, sincronización y las opciones de impresión offline seguirán funcionando con DB y BUCKET.

Los servicios tienen disponibilidad y consumo según tu plan. La aplicación limita las solicitudes, pero esos límites no sustituyen los controles de tu cuenta Cloudflare.

## 5. Crear el administrador

En la configuración del Worker, agrega como **Secret**:

| Secret | Qué colocar |
|---|---|
| `SETUP_TOKEN` | Un código aleatorio privado de al menos 20 caracteres; se recomienda 32 o más |

Luego:

1. Abre tu aplicación publicada por HTTPS.
2. Entra a **Sincronización**.
3. Abre **Primer acceso del administrador**.
4. Escribe tu correo, una contraseña de al menos 12 caracteres y el código de instalación.
5. Pulsa **Conectar dispositivo**.
6. El servidor crea el administrador una sola vez. En accesos posteriores usa correo y contraseña, dejando el código vacío.
7. Tras crear el administrador puedes retirar `SETUP_TOKEN` de Cloudflare. La cuenta seguirá funcionando.
8. En **Administrar usuarios** puedes crear otros usuarios de tu espacio. Para tu teléfono y computador también puedes usar la misma cuenta.

El código de instalación de la prueba local no existe en producción. El ZIP no contiene una contraseña ni una clave de administrador de producción.

## 6. Habilitar IA

Con el binding `AI` habilitado, el asistente utiliza Workers AI. El modelo se define en la variable `AI_MODEL` y puede cambiarse desde la configuración.

- Valor incluido: `@cf/meta/llama-3.1-8b-instruct`.
- `AI_DAILY_LIMIT`: cantidad de solicitudes por usuario y día; valor inicial 30, máximo permitido por el servidor 200.
- El asistente recibe las secciones textuales, las mediciones y el checklist seleccionados por la aplicación. No recibe las fotografías ni las firmas.
- Cada propuesta aparece en una caja editable. Solo se incorpora cuando el usuario acepta el texto.

La calidad y disponibilidad del modelo deben probarse con tus informes reales antes de utilizarlo de forma habitual.

## 7. Configurar correo

La opción **Abrir correo** utiliza la aplicación de correo del dispositivo. La opción **Enviar enlace por correo** utiliza Resend desde el servidor.

Para enviar desde la plataforma:

1. Configura un dominio o remitente verificado en Resend.
2. Guarda `RESEND_API_KEY` como Secret del Worker.
3. Guarda `EMAIL_FROM` como variable o Secret, por ejemplo `Informes <informes@tu-dominio.cl>`.
4. Emite y sincroniza el informe.
5. En **Compartir**, crea su enlace privado y elige el destinatario.
6. Envía el correo. Incluye el enlace al documento y su descarga PDF, sin adjunto automático.

Se registran los envíos y se usa una clave de idempotencia para evitar duplicados del mismo enlace al mismo destinatario.

## 8. WhatsApp y archivos

- **WhatsApp:** abre la conversación con el texto y el enlace privado; el usuario confirma el envío en WhatsApp. No requiere la API de WhatsApp Business.
- **Compartir archivo PDF:** genera el PDF y abre el menú nativo cuando el navegador soporta compartir archivos. Si no lo soporta, deja el PDF descargado para adjuntarlo manualmente.
- **Sin internet:** crea y guarda el informe; usa Imprimir / Guardar como PDF. La entrega por WhatsApp o correo se realiza cuando recuperes conexión.
- Los enlaces privados caducan por defecto en siete días y pueden revocarse. Quien tenga el enlace puede abrir esa versión del documento durante su vigencia.

## 9. Probar sincronización entre dos dispositivos

1. Inicia sesión en el computador y en el teléfono con la misma cuenta.
2. Espera a que ambos indiquen **Cambios sincronizados**.
3. En el teléfono, abre el informe y activa modo avión.
4. Modifica y guarda una sección; debe indicar guardado local.
5. Recupera internet con la aplicación abierta.
6. Espera la sincronización y comprueba el cambio desde el computador.
7. Para probar conflictos, modifica el mismo informe en ambos equipos mientras uno está offline. Al reconectarlo, la app debe solicitar comparar versiones y no sobrescribir silenciosamente.
8. Después de emitir un informe, verifica que los campos se bloquean y que **Crear revisión** genera otra versión conservando la anterior.

## 10. Actualizaciones desde GitHub

Cada commit en la rama conectada ejecuta las comprobaciones y publica la nueva versión. La aplicación descarga la nueva caché al tener conexión. Antes de activarla guarda el documento activo; si el guardado falla, espera.

En la primera actualización desde v1.2, el service worker anterior puede seguir mostrando la interfaz vieja hasta cerrar todas las pestañas y la aplicación instalada. Primero guarda y exporta tus informes, después cierra y vuelve a abrir la dirección.

La aplicación no garantiza sincronización con el navegador cerrado ni trabajo en segundo plano ilimitado. Vuelve a abrirla al recuperar internet. Conserva los respaldos y revisa el estado de sincronización antes de cambiar de dispositivo.

## 11. Si algo falla

| Mensaje / síntoma | Revisión |
|---|---|
| `REEMPLAZAR_CON_ID_D1` | Falta el ID real de D1 en GitHub |
| `no such table` | Aplica la migración D1 remota |
| Error de bucket | Crea R2 y comprueba el nombre del binding BUCKET |
| Código de instalación incorrecto | Revisa SETUP_TOKEN y su longitud en el Worker publicado |
| Administrador ya creado | Inicia sesión sin código de instalación |
| Modo local / servidor sin configurar | Comprueba DB y BUCKET y vuelve a desplegar |
| La sesión venció | Inicia sesión otra vez; los informes locales permanecen |
| Hay conflictos | Descarga respaldo, compara y elige la versión a conservar |
| PDF directo no disponible | Habilita BROWSER o utiliza la impresión offline |
| Correo no disponible | Configura Resend y el remitente; utiliza Abrir correo mientras tanto |
| Sigue apareciendo v1.2 | Guarda, cierra todas las pestañas y vuelve a abrir con conexión |

## Documentación oficial consultada

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/wrangler/commands/d1/
- https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/
- https://developers.cloudflare.com/workers-ai/configuration/bindings/
- https://resend.com/docs/api-reference/emails/send-email
