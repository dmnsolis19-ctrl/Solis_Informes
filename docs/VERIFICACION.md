# Verificación de la entrega 2.1.0

Fecha: 23 de octubre de 2026.

## Pruebas automáticas

38 pruebas superadas con `node scripts/ci.mjs`, revisión de sintaxis de 21 módulos y compilación de 15 recursos locales. No se requieren recursos de CDN para abrir la interfaz.

Se conserva la cobertura anterior: nueve plantillas, emisión, revisiones, presupuestos, fecha local, importación anterior, concurrencia, autenticación, aislamiento de espacios, fotografías privadas, enlaces, caché offline y contratos de IA, correo y PDF.

Cobertura nueva:

- Migración SQL sobre una base con documentos existentes: conserva datos, versiones, secuencia e historial y mantiene los índices y disparadores.
- Selección de equipos que completa cliente e instalación y copia los datos al informe.
- Historial por ID estable, conservando revisiones aunque cambie el TAG.
- Plantillas independientes con orden documental, verificaciones, mediciones inicialmente vacías, secciones y campos adicionales obligatorios.
- Hallazgos: contenido mínimo, responsable y plazo para prioridades altas, evidencia de cierre y referencias de fotografías existentes.
- Texto escapado y citas a las figuras en el documento.
- Sincronización de catálogos, compatibilidad de lectura con clientes anteriores y rechazo de escrituras antiguas que perderían relaciones.
- TAG único por empresa, conflictos, archivado y restauración con historial.
- Un equipo reubicado no cambia la ubicación registrada en un informe anterior ni impide sincronizarlo.
- Plantillas sincronizadas y validación de sus requisitos en el servidor antes de emitir.
- Impedimento de transferir registros existentes entre empresas.
- Precarga de los dos módulos nuevos en la caché offline.

El adaptador de pruebas usa SQLite real. R2 se reproduce en memoria; Workers AI y Browser Run utilizan dobles de servicio. No se enviaron correos, no se consumió IA ni se generó un PDF real en los recursos Cloudflare del usuario.

## Revisión en navegador

Recorrido verificado con datos de demostración:

1. Crear cliente e instalación desde el directorio.
2. Registrar un equipo con TAG y serie.
3. Crear una plantilla propia, marcar Revisor como obligatorio, mover la sección Hallazgos y agregar una sección de procedimiento.
4. Crear un informe desde el historial del equipo con esa plantilla.
5. Comprobar cliente, instalación, datos de equipo y textos iniciales copiados.
6. Completar redacción y sección propia; agregar y guardar un hallazgo.
7. Abrir la vista previa y verificar identidad corporativa, orden modificado, hallazgo y contenido adicional.
8. Regresar al historial y comprobar la presencia del informe y el hallazgo.
9. Revisar directorio y equipos en contenedores de 390 y 768 píxeles: sin desbordamiento horizontal en las vistas examinadas.

La revisión adaptable se realizó en Chrome, no en dispositivos físicos. La previsualización interna usa HTTP; la instalación PWA y el funcionamiento offline completo deben comprobarse en el HTTPS publicado o en localhost. El ciclo del service worker y la navegación sin red se verifican mediante pruebas simuladas.

## Comprobaciones en tu nube después de actualizar

1. Confirmar la migración 0002 sin cambiar el ID de D1 ni recrear los recursos.
2. Verificar sincronización real computador ↔ teléfono de un cliente, instalación, equipo, plantilla e informe con fotografías.
3. Producir un conflicto desde dos dispositivos y resolverlo conservando el resultado elegido.
4. Abrir por HTTPS, desconectar internet, reabrir y guardar cambios; reconectar con la aplicación abierta y comprobar sincronización.
5. Generar un PDF real con textos largos, hallazgos y fotografías; revisar saltos y numeración.
6. Probar compartir por WhatsApp y correo en Android/iOS. Verificar un envío real si tienes correo configurado.
7. Revisar que la IA mantenga los hechos registrados, incluidos los hallazgos.
8. Comprobar una actualización con un borrador activo; cerrar los formularios de configuración antes de aplicarla.
9. Descargar e importar un respaldo en un perfil de prueba; comprobar catálogos, plantillas, imágenes y registros archivados.

La entrega prepara el código para tu repositorio. No acredita que esta versión esté desplegada o probada en tu cuenta de Cloudflare.
