# SOLIS Field Pro 3.0.0

Plataforma para informes técnicos, diagnósticos, evaluaciones de terreno, propuestas y seguimiento de intervenciones. Conserva el trabajo local y sincroniza con Cloudflare al recuperar conexión, con la aplicación abierta.

**Si ya está publicada, empieza por [ACTUALIZAR_v3.0.0.md](ACTUALIZAR_v3.0.0.md). Conserva tu `wrangler.jsonc` actual.** El ZIP de actualización lo excluye para proteger tu Worker y los identificadores de D1/R2.

Para una instalación nueva, copia `wrangler.example.jsonc` como `wrangler.jsonc` y sigue [docs/GITHUB_CLOUDFLARE.md](docs/GITHUB_CLOUDFLARE.md).

## Funciones

- Nueve bases documentales y plantillas propias por empresa, con marca, logo, colores, estructura, encabezado y pie. Cada informe conserva una copia de su empresa y plantilla.
- Diseñador de bloques: texto, número, fecha, selección, tabla, fotografía y firma; orden configurable, condiciones de visibilidad y obligatoriedad. Historial central de versiones de plantilla.
- Directorio de clientes, instalaciones y equipos; historial por activo, fotografías, materiales y tendencias de mediciones con la misma variable y unidad.
- Panel de operaciones con filtros, estados, actividad por técnico, próximos trabajos y alertas por umbral, recurrencia o vencimiento.
- Hallazgos con prioridad, responsable, fecha, evidencia de cierre y referencias a fotografías. Tareas independientes para seguir pendientes sin modificar el documento emitido.
- Órdenes y planes derivados de documentos aprobados o emitidos. Planificación periódica mediante «Programar siguiente», sin duplicar una intervención ya programada.
- Flujo de servidor: Borrador → En revisión → Aprobado → Emitido. Revisión técnica, devolución motivada y auditoría. Emitidos bloqueados; cambios posteriores mediante revisión.
- Usuarios con roles administrador, técnico, supervisor, aprobador y cliente; empresas autorizadas por cuenta y organizaciones con espacios de datos separados.
- Portal restringido al cliente: sus documentos emitidos, anexos PDF, acciones y comentarios registrados.
- Etiquetas QR locales, lectura por cámara o imagen y búsqueda por TAG. Notas de voz guardadas en el dispositivo y transcripción revisable mediante Workers AI.
- Biblioteca de documentos autorizados, importación de texto, PDF original privado, conversión PDF a texto con Workers AI y consultas que muestran las fuentes utilizadas.
- IA para redactar con los datos del informe y revisión de coherencia basada en reglas. Las propuestas requieren aceptación del responsable.
- Documento A4, anexos PDF privados, impresión offline y PDF de servidor con páginas numeradas. Caché privada de PDF emitidos.
- Enlaces temporales revocables, WhatsApp, correo del dispositivo y entrega desde servidor mediante Resend configurado.
- PWA adaptable a teléfono, tablet y escritorio, sin CDN; guardado automático, respaldo, papelera, importación y conflictos visibles. Sincronización con reintentos, referencias ordenadas y control de cambios concurrentes.

[docs/USO_V3.md](docs/USO_V3.md) explica los recorridos y condiciones de cada función. [docs/VERIFICACION.md](docs/VERIFICACION.md) diferencia las pruebas realizadas de la validación pendiente en tu nube.

## Desarrollo y comprobación

Node.js 22.13 o superior; recomendado Node.js 24. Sin dependencias de ejecución instaladas con npm.

```bash
node scripts/dev.mjs
```

Abre `http://localhost:4173`. Windows: `INICIAR_APP.bat`.

El servidor de desarrollo usa SQLite y archivos locales. Para la primera instalación local, el código es `solis-local-installation-2026`; no funciona en Cloudflare. Usa un correo de prueba y contraseña de al menos 12 caracteres. Sus datos quedan en `.local-data/`, excluido del paquete. IA, transcripción, conversión PDF, correo y PDF de servidor necesitan sus servicios reales y no están simulados en la interfaz.

```bash
node scripts/ci.mjs
```

Las pruebas usan SQLite real mediante un adaptador D1, R2 en memoria y dobles para servicios externos. No consumen IA, envían correo ni despliegan recursos del usuario.

## Arquitectura

| Carpeta | Contenido |
|---|---|
| `public/` | Interfaz, reglas de dominio, IndexedDB y service worker |
| `worker/` | API, sesiones, permisos, sincronización y servicios |
| `migrations/` | Migraciones D1 0001, 0002 y 0003; historial y auditoría |
| `scripts/` | Servidor local, CI, caché y despliegue |
| `tests/` | Dominio, migración, API, permisos, sincronización y offline |
| `docs/` | Instalación, uso y verificación |

Los QR usan bibliotecas locales con licencias incluidas en `THIRD_PARTY_NOTICES.md`.

## Conservación de datos y límites

Se conserva la base IndexedDB `solis-generator-maintenance` y sus registros al abrir en el mismo origen y perfil. Si cambias de dirección, navegador o dispositivo, exporta e importa un respaldo. Publicar código en GitHub no traslada datos locales. Las migraciones D1 conservan documentos, versiones e historial existentes.

Cada cuenta que trabaje offline debe usar un perfil propio del navegador. La sincronización se vincula a esa cuenta y organización. Los datos locales no se cifran por la aplicación; cerrar sesión conserva el trabajo del dispositivo. Cambiar permisos en el servidor evita nuevos accesos, pero no borra copias descargadas previamente.

Se necesita una primera apertura con internet para preparar la PWA. Las actualizaciones se activan después de guardar el borrador; esperan si hay un formulario abierto. La sincronización necesita sesión y aplicación abierta; no se garantiza con el navegador cerrado. Las solicitudes de aprobación offline permanecen pendientes hasta que el servidor comprueba permisos y versión.

Las alertas se calculan al consultar el panel. Esta entrega no envía avisos programados de forma desatendida. «Programar siguiente» genera la próxima intervención con una acción del usuario. Las firmas dibujadas son imágenes y no firmas digitales certificadas. La IA requiere revisión técnica; los servicios Cloudflare/Resend necesitan configuración y sus límites de consumo. No incluye facturación de suscripciones SaaS ni automatización de WhatsApp Business.
