# Revisión técnica de SOLIS Field Pro 3.4.0

Fecha: 24 de octubre de 2026.

## Base y alcance

La copia local verificada y el archivo disponible corresponden a 3.2.0. Se buscó el ZIP 3.3.0 citado en la conversación externa, pero no estuvo accesible. Las plantillas HVAC, electricidad, automatización y fotovoltaica se reconstruyeron a partir de sus requisitos descritos, sin afirmar identidad con aquel ZIP ni incorporar modificaciones externas desconocidas.

El conjunto final mantiene trece bases, plantillas propias con bloques configurables y las funciones previas de instrumentación, puesta en marcha, diagnósticos, fallas, mantenimiento, evaluaciones y propuestas. Los parámetros nuevos comienzan sin lecturas ni límites de aceptación predeterminados.

## Problemas corregidos

| Área | Problema observado | Resultado |
|---|---|---|
| Edición local | Un guardado con el mismo número de versión podía sustituir otra mutación local todavía pendiente. | Se compara la identidad de la mutación dentro de la transacción. El segundo informe se conserva como copia, sin reemplazar el primero. |
| Guardado en cola | Se capturaban datos antes de terminar el guardado anterior. | La captura se hace al ejecutar el turno de guardado, con su metadato actualizado. |
| Actualización remota | Dos mutaciones ausentes se consideraban iguales y podían adelantar la versión del editor sin actualizar su contenido. | Solo se adoptan metadatos del mismo envío identificado; un formulario con cambios conserva su versión de lectura. |
| Recuperación | No existía un recorrido para revisar y recuperar la edición alternativa. | Copias resguardadas por empresa, recuperación idempotente y borrador nuevo sin autorización heredada. |
| Navegación | La especialidad y el siguiente paso del documento no estaban claramente visibles. | Búsqueda/filtro de bases y recorrido documental. |
| PDF | El archivo recuperado desde caché perdía el nombre por folio/revisión. | Mismo Content-Disposition en la primera descarga y las siguientes. |
| Despliegue | JSON.parse rechazaba comentarios válidos en un archivo llamado wrangler.jsonc. | Parser JSONC local, probado con comentarios, cadenas, URLs y comas finales. |

## Pruebas ejecutadas

`npm run ci`: **84 pruebas superadas**, revisión de sintaxis y compilación de los recursos locales. Sin nuevas dependencias npm.

Cobertura añadida:

- Dos conexiones de almacenamiento con lectura del mismo borrador: primer guardado intacto y copia de la segunda edición.
- Recuperación repetida/concurrente: un solo informe independiente, sin firmas, asignaciones ni aprobaciones heredadas.
- Exportación/importación de las copias, sin duplicarlas en importaciones repetidas.
- Rechazo de un catálogo obsoleto y recuperación limitada a la empresa activa.
- Guardados consecutivos propios sin crear conflictos falsos.
- Recepción remota sin modificar la versión de un formulario que contiene cambios no guardados.
- Contrato de validación del Worker y HTML documental para las cuatro especialidades nuevas, con lecturas vacías.
- Búsqueda de servicios con acentos, filtros y compatibilidad con bases futuras.
- Recorrido del editor sin introducir acciones de cambio de estado que salten los controles existentes.
- Nombre estable del PDF en caché y parser de configuración.
- Precarga de los módulos nuevos en el service worker.

Se mantienen las pruebas anteriores de permisos, aislamiento multiempresa, portal, revisión/emisión, enlaces privados, archivos y sincronización contra Worker con SQLite real. IndexedDB y DOM se comprueban con dobles de frontera. Los servicios PDF/IA/correo se prueban mediante contratos simulados, sin consumos externos.

## Pendiente de validar

- Chrome/Edge/Safari en escritorio y teléfono, incluida la prueba real de dos pestañas y cuotas de IndexedDB.
- Apariencia, accesibilidad y recorridos con equipos y documentos representativos.
- Paginación real de informes extensos, fotografías y anexos con el servicio PDF configurado.
- Workers AI, correo, cámara y sincronización multiempresa en tu entorno Cloudflare.

Esta entrega no configura ni publica recursos en tu cuenta y no declara la plataforma validada para producción empresarial. Las actualizaciones anteriores abiertas simultáneamente no incorporan la nueva protección: actualiza todas las pestañas.
