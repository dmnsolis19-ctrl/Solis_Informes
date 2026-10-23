# Actualización 2.1.0 — gestión de operaciones

Para actualizar la aplicación ya publicada, sigue **[ACTUALIZAR_v2.1.0.md](ACTUALIZAR_v2.1.0.md)**. Conserva tu configuración Cloudflare actual.

Esta versión agrega clientes e instalaciones reutilizables, catálogo de equipos con historial, hallazgos vinculados a fotografías y plantillas por empresa con orden y campos configurables. Los nuevos registros participan en el guardado offline, respaldo y sincronización con resolución de conflictos.

Para una instalación nueva, copia `wrangler.example.jsonc` como `wrangler.jsonc` y sigue la guía de GitHub/Cloudflare. Para una actualización no hagas esa copia.

# SOLIS Field Pro 2.1.0

Plataforma de informes técnicos y propuestas con marca de empresa configurable, trabajo offline, control de revisiones, evidencias y sincronización automática con Cloudflare.

**Comienza por [docs/GITHUB_CLOUDFLARE.md](docs/GITHUB_CLOUDFLARE.md).** Allí está el recorrido completo para subir el proyecto a GitHub y conectarlo a tu Worker.

## Incluido

- Nueve plantillas: mantenimiento de grupos electrógenos, instrumentación, levantamiento, diagnóstico, informe general, propuesta técnica/económica, evaluación en terreno y análisis de falla, más pruebas/puesta en marcha.
- Perfiles de empresa con razón social, identificación, dirección, contacto, logo, colores, moneda y pie de página. Los informes conservan una copia de los datos de la empresa.
- Editor por pasos; objetivos, alcance, limitaciones, actividades, hallazgos, conclusiones, recomendaciones, múltiples equipos y plan de acciones.
- Partidas comerciales, cantidades, precios, impuesto, total, vigencia y condiciones de las propuestas.
- Guardado automático local, folios con contador e identificador de dispositivo, historial, revisión y emisión bloqueada.
- Fotografías completas, descripción y referencia al hallazgo; firmas dibujadas opcionales.
- PDF A4 desde Cloudflare Browser Run con numeración de páginas; impresión / Guardar como PDF disponible offline.
- Enlaces de entrega de siete días, revocación, WhatsApp, correo y menú nativo de compartir PDF cuando el dispositivo lo permite.
- Correo desde servidor mediante Resend, opcional. El correo incluye el enlace privado; el destinatario descarga el PDF desde ese enlace.
- Asistente de redacción mediante Workers AI con propuesta editable y aceptación manual.
- PWA sin dependencias de CDN. Sincroniza al recuperar internet, al volver a la app y aproximadamente cada 30 segundos mientras está abierta. Usa reintentos progresivos si falla el servidor.
- Conflictos visibles y comparables; no se sobrescriben silenciosamente cambios de dos dispositivos.
- Papelera restaurable; importación que combina registros nuevos sin reemplazar los existentes.
- Sesiones con cookies HttpOnly; contraseñas PBKDF2; aislamiento de datos por espacio de trabajo; archivos privados en R2.
- Diseño adaptado a escritorio, teléfono y tablet.

## Probar en tu computador

Requiere Node.js 22.13 o superior; se recomienda Node.js 24.

```bash
node scripts/dev.mjs
```

Abre `http://localhost:4173`. En Windows también puedes usar `INICIAR_APP.bat`.

El servidor de prueba reproduce la API con SQLite local y archivos locales. En **Sincronización → Primer acceso del administrador**, usa el código de prueba `solis-local-installation-2026`, tu correo y una contraseña de al menos 12 caracteres. Ese código es exclusivo del servidor local; no funciona en Cloudflare. Los datos se guardan en `.local-data/`, excluido de Git y del paquete de entrega.

El asistente IA, PDF directo y correo usan servicios externos y no están simulados en la interfaz local. La impresión offline sí está disponible.

## Verificación

```bash
node scripts/ci.mjs
```

Las pruebas usan SQLite real a través de un adaptador de la interfaz D1 y R2 en memoria. Las respuestas de IA y generación PDF se prueban con dobles de servicio; no se consumen servicios externos ni se envían correos reales.

Consulta [docs/VERIFICACION.md](docs/VERIFICACION.md) para el alcance y las pruebas pendientes en tu cuenta.

## Estructura

- `public/`: interfaz sin proceso de compilación de framework, módulos ES, estilos y PWA.
- `worker/`: API Cloudflare, autenticación, validación y servicios.
- `migrations/`: esquema D1, historial de cambios y control de versiones.
- `scripts/`: servidor local, compilación de caché, comprobaciones y despliegue.
- `tests/`: pruebas de reglas, concurrencia, seguridad, almacenamiento y servicios.
- `wrangler.jsonc`: recursos y nombre del Worker.

Esta versión sustituye el proyecto anterior de Next/Vinext por módulos web y un Worker independiente. Reduce las dependencias necesarias para el trabajo offline y facilita el despliegue directo desde GitHub. No mezcles los archivos de ambas versiones. Conserva el respaldo de la v1.2 antes de actualizar.

## Datos existentes

La app conserva el nombre de la base IndexedDB anterior (`solis-generator-maintenance`) y migra sus registros al abrirla en el **mismo origen y perfil del navegador**. Los informes finalizados de la versión anterior se conservan bloqueados y se identifican como documentos legados importados. No se inventan los nuevos campos faltantes; para completarlos, crea una revisión.

Si cambias de dirección web, navegador o dispositivo, usa **Descargar respaldo** en la versión anterior y **Importar** en esta versión. El almacenamiento del navegador pertenece a cada origen. GitHub y la publicación del código no trasladan los informes locales.

## Límites operativos

La sincronización requiere D1/R2 configurados y una sesión activa. Se ejecuta mientras la aplicación está abierta; los navegadores móviles no garantizan trabajo en segundo plano con la aplicación cerrada. Si se vence la sesión, el guardado local continúa y debes iniciar sesión para sincronizar.

El mismo espacio puede contener varias empresas y usuarios. Los usuarios del espacio comparten todas sus empresas; no se ofrece todavía una separación de permisos por empresa ni un sistema de suscripciones SaaS. Para organizaciones completamente independientes, utiliza espacios/despliegues separados. La base local no está cifrada por la aplicación: en dispositivos compartidos, utiliza perfiles distintos del navegador.

La nueva versión de la app se descarga cuando vuelve la conexión. Se guarda el informe activo antes de activar la actualización y se intenta recuperar el editor. Si el guardado falla, la actualización espera. Debes abrir la app al menos una vez con internet para preparar la caché offline.

La firma dibujada registra una imagen; no constituye una firma digital certificada. La IA propone texto y requiere revisión técnica. Configura los servicios y sus límites de consumo antes de habilitarlos para varios usuarios.
