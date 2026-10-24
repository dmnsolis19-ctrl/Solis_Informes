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
