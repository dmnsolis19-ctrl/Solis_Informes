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
