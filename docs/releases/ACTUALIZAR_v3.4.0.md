# Actualizar a SOLIS Field Pro 3.4.0

## Procedencia

Esta entrega utiliza el código verificado de 3.2.0 y recupera las bases multiespecialidad descritas para 3.3.0. El ZIP 3.3.0 no estuvo accesible en esta sesión, por lo que no se realizó una comparación literal de sus archivos. Si añadiste cambios propios a ese proyecto, consérvalos en tu control de versiones y compara antes de reemplazar archivos.

## Instalación

1. Guarda los formularios y descarga un respaldo desde cada dispositivo con trabajo local. Cierra las pestañas adicionales antes de actualizar.
2. Copia el contenido del ZIP en la raíz de tu proyecto, reemplazando los archivos del código. Incluye las carpetas completas `public`, `worker`, `scripts` y `tests`.
3. Conserva tu `wrangler.jsonc` actual y sus identificadores, bindings y secretos. El paquete excluye ese archivo y los datos de pruebas.
4. No hay migraciones nuevas de D1 ni IndexedDB. Conserva las migraciones existentes.
5. Ejecuta `npm run ci` con Node.js 24 y publica mediante tu flujo habitual. Esta entrega no despliega en producción.
6. Guarda y recarga la aplicación en la misma dirección y perfil. La barra lateral debe indicar `Field Pro · v3.4.0`.

## Nuevos recorridos

- **Plantillas:** busca por servicio o filtra por especialidad. Las trece bases son puntos de partida; las plantillas propias permanecen disponibles para cualquier servicio futuro.
- **Editor:** el recorrido Preparar → Revisar → Aprobar → Entregar indica el siguiente paso sin saltar los controles de revisión y aprobación existentes.
- **Copias resguardadas:** si otra pestaña guarda primero, la edición alternativa no reemplaza ese informe. Se muestra un aviso y la copia queda en Sincronización → Copias resguardadas.
- **Recuperar copia:** crea un informe nuevo con folio propio, estado Borrador y sin firmas/aprobaciones heredadas. Abrir nuevamente la misma recuperación conserva el informe ya creado.
- **Respaldos:** ahora incluyen copias resguardadas y la vista previa indica cuántas se recuperarán.

## Prueba de dos pestañas

Con datos de prueba, abre un mismo borrador en dos pestañas. Guarda un cambio en la primera y un cambio diferente en la segunda. Comprueba que el primero sigue guardado y el segundo puede recuperarse desde Copias resguardadas. Repite sin conexión tras preparar la PWA. Actualiza ambas pestañas a esta versión antes de la prueba: una versión antigua no contiene la nueva protección.

La protección es de escritura optimista, no un bloqueo exclusivo. Una operación sobre un catálogo obsoleto se detiene y conserva el formulario abierto para que revises el cambio. Las copias automáticas se crean para informes.

## Configuración y servicios

El despliegue admite `wrangler.jsonc` con comentarios y comas finales. Continúa necesitando tus recursos y credenciales existentes. El generador PDF reutiliza el archivo privado con un nombre estable por folio y revisión.

Siguen pendientes las comprobaciones visuales en dispositivos reales, la paginación del PDF con contenido representativo y el funcionamiento de tus servicios reales de Cloudflare. Revisa `docs/REVISION_3.4.md`.
