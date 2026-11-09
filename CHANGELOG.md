# 3.9.0 · Carga por técnico y reasignar · 9 de noviembre de 2026

- Vista «Carga» en el Planner (selector «Lista | Calendario | Carga», se recuerda en cada dispositivo): tabla de responsables por semanas con las visitas abiertas (Planificada o En curso). Columnas «Vencidas» y las 6 semanas que parten el lunes de la semana actual («Sem. 9 nov»); la intensidad de cada celda es relativa al máximo de la tabla y siempre muestra el número. Responsable por cuenta (correo) o nombre; sin ninguno, «Sin técnico». Respeta los filtros de técnico, cliente y equipo.
- Al pulsar una celda (o «Vencidas») se listan debajo sus visitas con las mismas tarjetas y acciones que la lista. En móvil la tabla se desplaza dentro de su contenedor con la primera columna fija; la página no desborda.
- «Reasignar» en cada visita Planificada (solo administrador, supervisor o modo local): elige una persona de la empresa, «Sin técnico» o escribe el responsable en modo local. La visita queda con edición manual (protegida de «Correr calendario» y de los cambios del plan). Si cambió en otro dispositivo o ya no está Planificada, avisa sin escribir; el botón se bloquea mientras guarda.
- Pendiente cerrado: un técnico que abre un plan lo ve en solo lectura (campos deshabilitados, próxima visita e historial de anclas) en lugar del error «Tu rol no permite administrar planes»; en las tarjetas de planes ve «Ver plan» sin pausar ni cerrar.
- Pendiente cerrado: al cerrar sesión se guarda el rol «none», de modo que un dispositivo compartido sin conexión ya no trata «sin sesión» como modo local del usuario anterior.
- Sin migración D1, sin cambios en IndexedDB ni en la sincronización.
- 234 pruebas automáticas superadas y 18 pruebas de navegador superadas.

# 3.8.0 · Calendario del Planner y ajustes · 9 de noviembre de 2026

- Vista de calendario en el Planner: cuadrícula mensual con la semana desde el lunes y los días de los meses vecinos atenuados. Cada día muestra hasta 3 visitas (nombre y TAG del equipo cuando caben) y «+N más»; las vencidas van en rojo, las en curso destacadas, las completadas en verde y las canceladas no se muestran. Respeta los filtros por técnico, cliente y equipo.
- Selector «Lista | Calendario» en la cabecera del Planner; la elección se recuerda en cada dispositivo (si el navegador no guarda datos, igual funciona y parte en Lista).
- Navegación por mes con «Mes anterior», «Mes siguiente» y «Hoy»; se puede ir a cualquier mes (los meses sin visitas se ven vacíos).
- Al pulsar un día se listan debajo todas sus visitas con las mismas tarjetas y acciones que la lista («Iniciar visita», «Abrir informe», «Abrir / editar»). Por defecto queda seleccionado hoy. Cada día es un botón con etiqueta accesible («9 de noviembre de 2026, 2 visitas») y se maneja con teclado.
- En móvil (hasta 600 px) las etiquetas se reemplazan por un contador por día y el detalle está en la lista del día elegido; sin desplazamiento horizontal.
- Corrección del diálogo «Crear plan»: los cuadros de selección de equipos salían enormes porque heredaban el estilo de los campos de texto; ahora miden 20 px y quedan junto a su nombre. La lista de equipos se ordena por TAG.
- Sin migración D1, sin cambios en IndexedDB ni en la sincronización: el calendario es otra vista de las mismas visitas y no cambia cuándo se generan o cierran.
- 217 pruebas automáticas superadas y 13 pruebas de navegador superadas.

# 3.7.0 · Planner de mantenimiento · 9 de noviembre de 2026

- Entrada «Planner» en el menú, antes de «Órdenes y mantenimiento»: visitas por urgencia en «Vencidos», «Hoy», «Esta semana» y «Próximos 30 días», con filtros por técnico, cliente y equipo, marca «Sin técnico» y aviso de planes en pausa.
- Planes de mantenimiento (órdenes de tipo «Plan de mantenimiento») con fecha ancla y periodicidad en días de calendario fijo, técnico por defecto, plantilla de informe y alcance. Un plan por equipo al aplicarlo a varios; se admiten varios planes por equipo. Acciones: crear, editar, pausar, reanudar y cerrar (un plan cerrado no se reabre). Al cerrar un plan se cancelan sus visitas futuras Planificadas sin edición manual (motivo «plan cerrado»; nunca se borran; En curso, Completadas, con edición manual y pasadas no se tocan); si una visita cambió en otro dispositivo se omite y se avisa.
- Las visitas se generan por adelantado (90 días desde hoy) como órdenes individuales con id determinista `visit-<plan>-<AAAAMMDD>`. La generación corre en el cliente al abrir el Planner y tras sincronizar, y solo para administrador o supervisor (o modo local sin cuenta conocida).
- «Iniciar visita» crea un informe de servicio prellenado (cliente, sitio, equipo, objetivo y alcance; plantilla del plan o «Informe técnico general») y deja la visita «En curso»; luego «Abrir informe».
- Cierre: al abrir el Planner un administrador o supervisor, las visitas cuyo informe está «Emitido» se cierran solas si fueron a tiempo (el calendario se mantiene). Si se hicieron con retraso, el diálogo «Esta visita se hizo con retraso» ofrece «Mantener calendario» o «Correr calendario desde esta visita»; esta última toma la fecha de servicio del informe como nueva ancla, cancela con motivo «calendario corrido» las visitas futuras planificadas sin edición manual (nunca las borra), las recrea desde la nueva ancla y conserva el historial de anclas en el plan. Escape deja la visita «En curso».
- Editar la ancla o la periodicidad de un plan activo regenera las visitas futuras igual; reanudar un plan pausado las reconcilia. Los guardados se protegen contra sobrescribir registros modificados en otro dispositivo.
- Sin migración D1, sin cambios en IndexedDB ni en el protocolo de sincronización. El botón «Programar siguiente» de «Órdenes y mantenimiento» no cambia. El resumen diario por correo ya lista las órdenes vencidas o de la semana y ahora incluye las visitas del Planner (los planes no aparecen).
- 199 pruebas automáticas superadas y 9 pruebas de navegador superadas.

# 3.6.0 · Gráficos, verificación y seguridad · 3 de noviembre de 2026

- Cinco plantillas nuevas (18 en total): `plcFat`, `plcSat`, `waterPlant`, `bess` y `switchboard`; grupo «Agua y procesos». Sin lecturas ni límites inventados.
- Gráficos de línea en SVG (`public/js/charts.js`) guardados en el informe (`charts`, hasta 12 con 400 puntos), con zona horaria, resumen estadístico y reducción LTTB. Origen: historial del equipo o CSV importado (`energy-import.js`: separadores, coma decimal, formatos de fecha, fecha y hora separadas, energía integrada en kWh).
- Verificación pública: migración 0004 (`document_integrity`), huella SHA-256 canónica calculada por el servidor al emitir (`integrity`), página `/v/<código>` sin contenido del informe, QR en el documento y fecha de firma del cliente (`clientSignedAt`).
- Tarea diaria (`worker/scheduled.js`, 11:00 UTC): limpieza de sesiones y de copias de enlaces caducados hace más de 30 días, respaldo JSON por espacio en R2 (o `BACKUP_BUCKET`, 14 días) y resumen de pendientes por correo (Resend) una vez al día por usuario.
- Fotografías con hora y ubicación opcionales (`takenAt`, `geo`) y dictado por voz con el reconocimiento del navegador.
- Verificación en dos pasos TOTP (RFC 6238) con secreto cifrado (AES-GCM), ventana de ±30 s, sin reutilizar códigos, 8 códigos de recuperación y límite de intentos. Registro de errores de los dispositivos (`/api/client-errors`).
- Modelo de IA por defecto `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (configurable con `AI_MODEL`) y contexto acotado a 36.000 caracteres.
- `worker/index.js` dividido en `http`, `files`, `documents`, `sync-routes`, `ai`, `security`, `integrity`, `totp` y `scheduled`.
- El cliente declara capacidad de escritura 6; el servidor rechaza (426) ediciones de clientes anteriores sobre registros con gráficos, fecha de firma o datos de fotografía.
- Pruebas de navegador `e2e/` (sin conexión, importación y vista previa, doble factor, plantillas). 136 pruebas automáticas y 4 pruebas de navegador superadas.
- `[hidden]` ya oculta elementos con estilos propios; la política de permisos admite ubicación del mismo origen.

# 3.5.1 · Despliegue seguro, endurecimiento y PWA · 2 de noviembre de 2026

- `scripts/deploy.mjs` ejecuta el build antes de publicar; `scripts/build.mjs` excluye las capturas del precaché y funciona con rutas de Windows.
- `rateLimit` usa una sola sentencia atómica (`INSERT … ON CONFLICT … RETURNING`).
- Cabeceras `Strict-Transport-Security` y `Permissions-Policy` en la API y en los archivos estáticos.
- Lectura y vinculación de archivos privados mediante `file_access`; los archivos anteriores se autorizan una vez por referencia y quedan indexados. Fotografías y archivos se procesan en paralelo (6 a la vez) conservando el orden.
- Eliminada la ruta heredada `/api/users` (creaba cuentas `editor` con acceso a todas las empresas) y su código inactivo en el cliente.
- Manifest con íconos `any` y `maskable` separados, `description`, `lang`, `display_override`, categorías y capturas; ícono de 180 px y metas para iOS.
- Sin datos de empresa incluidos en el código: empresa inicial neutra que debe completarse antes de crear documentos.
- `.gitignore`, `.editorconfig`, configuración de Prettier y flujo de GitHub Actions (`node scripts/ci.mjs` y comprobación de `sw.js`).
- Documentación histórica movida a `docs/releases/`.
- Sin migraciones D1 ni cambios en IndexedDB ni en el protocolo de sincronización. 100 pruebas automáticas superadas.

# 3.5.0 · Estructura personalizada y productividad · 28 de octubre de 2026

- Actualización sobre el ZIP 3.4.0 entregado por el usuario; conserva sus trece bases, copias resguardadas, recuperación y control de guardados entre pestañas.
- Estructura de documento guardada en cada informe: títulos, orden, secciones opcionales, saltos y hasta 20 secciones propias de párrafos o listas.
- Formatos de orden Técnico, Ejecutivo e Inspección; espaciado y presentación de fotos, encabezado y pie.
- Plantillas nuevas reutilizables desde la estructura, sin arrastrar contenido ni resultados del informe de origen.
- Favoritos por empresa/dispositivo, búsqueda rápida con informes recientes de la empresa activa y atajos de navegación/guardado.
- Apariencia Claro/Oscuro/Dispositivo en interfaz y portal; impresión independiente.
- Validación compartida de estructuras, escape de texto, conservación en respaldos/revisiones y protección de escrituras antiguas que perderían el diseño.
- Se conservan IndexedDB v4, migraciones D1 0001–0003 y protocolo de lectura 4. El cliente declara capacidad de escritura 5 para proteger las estructuras nuevas.
- 95 pruebas automáticas superadas y revisión local de interfaz; servicios reales pendientes de comprobación en la nube del usuario.

# 3.4.0 · Borradores protegidos y servicios multiespecialidad · 24 de octubre de 2026

- Recuperación de las cuatro bases multiespecialidad descritas para 3.3.0 sobre el código verificado de 3.2.0. El ZIP 3.3.0 no estuvo disponible para comparación literal.
- Trece bases documentales y filtros por especialidad/servicio, sin restringir las plantillas propias.
- Comparación de mutaciones y versiones en la transacción local de guardado; impide reemplazar registros modificados por otra pestaña.
- Los borradores de informe que pierden la carrera se guardan como copias recuperables, sin modificar la edición ya guardada.
- Recuperación idempotente como informe nuevo, sin firmas ni autorizaciones heredadas, y respaldo/importación de las copias.
- Captura del borrador al ejecutar el guardado en cola, después de terminar el anterior, para evitar falsos conflictos propios.
- Una actualización remota no adelanta la versión de un formulario con cambios sin guardar.
- Recorrido documental y siguiente paso visible en el editor.
- El PDF conserva su nombre tanto en la generación inicial como desde la caché privada.
- El script de despliegue admite comentarios y comas finales en wrangler.jsonc.
- Sin nuevas dependencias, migraciones ni servicios externos.

# 3.2.0 · Recuperación y visibilidad de sincronización · 24 de octubre de 2026

- El respaldo espera el guardado del borrador y lee todas las entidades y notas en una transacción.
- Incluye solicitudes de revisión; al importarlas quedan por revisar, sin autorización implícita de envío.
- Vista previa de importación con recuentos de registros nuevos, existentes y archivados.
- Valida listas, versiones, empresas, referencias, TAG por empresa y folio/revisión antes de escribir; repite la validación dentro de la transacción de importación.
- Conserva íntegramente los registros existentes y sus notas. Revierte toda la importación si un guardado falla.
- Tabla de cambios pendientes de la empresa activa con filtros y detalle de errores persistidos por registro.
- Los rechazos de contenido o permisos no interrumpen el resto de envíos. Los fallos de sesión, red o servidor siguen interrumpiendo la operación.
- Las llamadas simultáneas a sincronizar esperan el mismo trabajo en curso.
- Indica el espacio estimado, la persistencia del navegador y la última descarga de respaldo solicitada.
- Diagnóstico de servicios según respuesta real de /api/status; distingue declaración de configuración y prueba funcional.
- Dos módulos de recuperación independientes; sin nuevas dependencias de ejecución ni migraciones D1/IndexedDB.

# 3.0.0 · Operación, revisión y conocimiento

- Panel operativo, filtros, actividad técnica, tendencias y alertas configurables.
- Diseñador de bloques, tablas, fotos, firmas, condiciones y versiones de plantilla.
- Tareas independientes, órdenes y mantenimiento periódico derivado de documentos aprobados.
- Roles y acceso por empresa, organizaciones independientes, portal por cliente y comentarios.
- Revisión, aprobación y emisión verificadas por servidor, devolución motivada, auditoría e idempotencia.
- QR local, notas de voz, transcripción revisable, documentos autorizados y consultas con fuentes.
- PDF adjunto privado y disponible offline; descarga autorizada por cliente y caché de PDF emitido.
- Migración 0003 preserva datos e historial; IndexedDB v4, respaldo de operaciones/voz y sincronización protocolo 4 ordenada por referencias.
- Archivos privados protegidos por empresa, incluidos los utilizados para generar PDF.

# 2.1.0 — 23 de octubre de 2026

- Clientes, instalaciones y equipos por empresa; búsqueda, edición, archivado y restauración.
- Selección de datos guardados en informes y relación de activos adicionales con el historial.
- Historial por ID de equipo, incluyendo revisiones y hallazgos de las intervenciones.
- Hallazgos con condición observada, prioridad, recomendación, responsable, plazo, estado, cierre y referencias fotográficas estables.
- Plantillas propias con base técnica/comercial, código, título, textos iniciales, verificaciones, mediciones, orden documental, campos adicionales obligatorios y secciones propias.
- Copias de datos y plantillas en cada informe para conservar su contexto histórico.
- Migración IndexedDB 3 y D1 0002 que conserva documentos, versiones y auditoría.
- Sincronización de seis tipos de entidad, compatibilidad de lectura v2 y protección contra escrituras antiguas que perderían los campos nuevos.
- TAG único por empresa en cliente y servidor; relaciones validadas dentro del espacio de trabajo.
- Respaldo 3 con catálogos, plantillas y registros archivados; admite respaldos anteriores.
- Nuevos módulos incluidos en caché offline y formularios adaptables a teléfono y tableta.
- 38 pruebas automáticas y recorrido funcional en navegador.

# 2.0.0 · 2026-10-23

- Plataforma de documentos para múltiples perfiles de empresa.
- Nueve categorías de informe, campos narrativos y propuestas económicas.
- Editor modular, autoguardado, folios por dispositivo y conservación de revisiones.
- Migración de registros IndexedDB v1.2 y compatibilidad con su respaldo JSON.
- PDF corporativo A4, evidencias sin recorte y firmas opcionales.
- PWA con assets locales y caché versionada; actualización con guardado previo.
- API Cloudflare con D1/R2, sesiones, validación, sincronización incremental y control de concurrencia.
- Carga individual de imágenes antes de sincronizar para evitar documentos JSON de gran tamaño.
- Enlaces temporales revocables, WhatsApp, menú de compartir y correo mediante proveedor configurable.
- Asistente de redacción mediante Workers AI.
- Ajustes de escritorio, teléfonos y tablets.
- Pruebas automatizadas y flujo GitHub → Cloudflare documentado.


## 3.1.0 — Diagnóstico y evidencias
- Nueva pantalla «Configuración y diagnóstico» con estado local, sesión, cambios pendientes y guía de bindings/secrets.
- El diagnóstico distingue las condiciones visibles del dispositivo de las pruebas reales de servicios remotos; no transmite informes automáticamente.
- Editor de evidencias: permite dibujar marcas sobre una copia de la fotografía y añade la copia anotada como nueva evidencia, conservando el original.
- Diseño adaptable para pantallas pequeñas.
