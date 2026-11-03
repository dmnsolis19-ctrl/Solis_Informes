# Revisión técnica de SOLIS Field Pro 3.2.0

Fecha: 24 de octubre de 2026. Base revisada: ZIP 3.1.0 proporcionado.

## Evaluación

La base ya tiene una separación útil entre dominio, persistencia, interfaz y Worker, permisos por empresa, documentos emitidos inmutables y pruebas de contratos con SQLite real. La suite inicial superó 57 pruebas. Esta entrega prioriza la recuperación de datos y la capacidad de localizar problemas de sincronización antes de ampliar funciones de negocio.

| Prioridad | Hallazgo en 3.1.0 | Cambio aplicado |
|---|---|---|
| Alta | Descargar un respaldo no esperaba el autoguardado del borrador. | La descarga espera `persist()` y el guardado pendiente. |
| Alta | El respaldo leía los almacenes por separado y podía combinar momentos distintos. | Lectura de entidades y metadatos en una transacción de solo lectura. |
| Alta | Una referencia ausente o una duplicidad de folio/TAG podía importarse y fallar después al sincronizar. | Validación conjunta antes de la vista previa y de nuevo dentro de la transacción de escritura. |
| Alta | Las solicitudes locales de revisión no estaban incluidas en el respaldo. | Se conservan como contexto y se recuperan en estado de revisión necesaria. |
| Alta | Un rechazo de un registro detenía el envío de todos los posteriores. | Se registra su motivo y continúan los demás envíos; red, sesión y errores de servidor sí detienen el ciclo. |
| Media | Una segunda llamada a sincronizar terminaba inmediatamente aunque había un envío activo. | Devuelve la misma promesa y espera su finalización. |
| Media | El usuario no podía ver qué entidad fallaba ni qué solicitudes requerían atención. | Cola por empresa con filtro, detalle del rechazo y acceso al informe. |
| Media | El diagnóstico mostraba D1/R2 disponibles sin consultar su configuración real. | Se consulta `/api/status` y se separa declaración de configuración de prueba funcional. |
| Media | No se mostraba el espacio disponible ni la persistencia concedida. | Lectura de Storage API cuando está disponible, sin asumir cuota o persistencia. |

## Verificación de esta entrega

- `npm run ci`: 72 pruebas superadas, revisión de sintaxis y compilación completa.
- Worker contra SQLite real y R2 en memoria: permisos, revisión, portal, concurrencia, archivos, enlaces y contratos de servicios.
- Sincronizador real contra Worker: envío ordenado, PDF local, estado offline, aislamiento de un registro rechazado, recuperación tras corregirlo y espera de llamadas simultáneas.
- Recuperación: versiones futuras, listas corruptas, duplicados, referencias cruzadas, TAG/folio únicos, marca histórica, importación sin sustituir existentes y solicitudes recuperadas sin envío automático.
- Persistencia: se ejecuta `store.js` con un doble de IndexedDB que simula transacciones y abortos, incluyendo fallo de escritura y cambio de datos entre vista previa e importación. Esta prueba no sustituye una validación en un navegador real.
- Interfaz de recuperación: espera del guardado antes del respaldo, confirmación previa a la importación, IDs estables y escape de errores HTML, con dobles de la frontera DOM.
- Service worker: precarga de los dos módulos nuevos, navegación sin red y exclusión de API y enlaces privados.

## Validaciones pendientes

No se realizó un despliegue en tu cuenta ni se consumieron IA, PDF remoto o correo reales. El navegador conectado no estaba disponible y el navegador alternativo no podía acceder al servidor local; por tanto, la revisión visual de escritorio y teléfono y la comprobación de IndexedDB en Chrome/Safari siguen pendientes. La guía de actualización incluye los pasos para comprobarlos en tu instalación.

## Siguientes mejoras propuestas

1. Validación funcional en un entorno de pruebas de Cloudflare con tus bindings reales: QR/cámara, Workers AI, PDF y envío a una dirección controlada.
2. Reducir responsabilidades de `app.js`, siguiendo la extracción de recuperación ya realizada; separar editor y diagnósticos en módulos propios.
3. Probar edición simultánea del mismo borrador en dos pestañas. El control actual de versiones remotas no compara todas las mutaciones locales cuando ambas copias están pendientes; se necesita definir el flujo de bloqueo o comparación antes de cambiarlo.
4. Mejorar el recorrido de navegación de terreno a revisión y entrega a partir de una prueba de uso real.

## Compatibilidad

Se conservan los nombres de los almacenes, la base local, las migraciones D1 y el protocolo 4 de sincronización. No se añadieron dependencias externas ni servicios nuevos. El ZIP excluye configuración y datos de ejecución del entorno de pruebas.
