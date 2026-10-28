# Actualizar de 3.4.0 a SOLIS Field Pro 3.5.0

Esta entrega parte del ZIP 3.4.0 que proporcionaste. Incluye el proyecto completo actualizado y conserva las trece bases, copias resguardadas, respaldo e importación avanzada, permisos y sincronización de esa versión.

1. Guarda los formularios y descarga un respaldo de cada dispositivo con cambios pendientes. Cierra las pestañas adicionales.
2. Extrae el ZIP y reemplaza su contenido en la raíz del repositorio conectado a Cloudflare. Incluye las carpetas completas `public/`, `worker/`, `scripts/`, `tests/` y `migrations/`.
3. **Conserva tu wrangler.jsonc actual**, IDs de D1/R2, bindings y secretos. El paquete no incluye ese archivo. `wrangler.example.jsonc` es una referencia para instalaciones nuevas.
4. No hay migraciones nuevas. Conserva 0001, 0002 y 0003, la base local y el mismo origen de la aplicación.
5. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs`. Usa Node.js 24.
6. Confirma el commit en la rama conectada. Cuando termine Cloudflare, abre la misma dirección con conexión, guarda/cierra formularios y vuelve a abrir la aplicación para activar su actualización. Comprueba `Field Pro · v3.5.0`.
7. Actualiza todas las pestañas y dispositivos. Las versiones anteriores no conocen el nuevo diseño; el servidor rechazará sus escrituras sobre documentos o plantillas con estructura personalizada para conservarla.

## Personalizar un informe

Abre un borrador → **Estructura del informe**.

- Cambia títulos y usa ↑ / ↓ para ordenar secciones.
- Muestra u oculta secciones opcionales. Ocultar no borra los datos, pero los excluye de la presentación y del PDF. Las secciones esenciales se mantienen visibles.
- Usa «Iniciar en página nueva» y revisa el resultado impreso; el paginado depende del contenido y del motor PDF.
- Agrega hasta 20 secciones propias, con párrafos o una lista de puntos. Las secciones propias visibles necesitan contenido antes de emitir.
- Selecciona espaciado, una/dos fotos por fila y textos de encabezado/pie. Los colores y el logo siguen perteneciendo a la empresa del informe.
- Técnico, Ejecutivo e Inspección reorganizan el documento sin borrar contenidos.
- Aplica la estructura o aplícala y abre su vista previa. Cancelar descarta los cambios no aplicados. En emitidos, crea una revisión.

La estructura forma parte del informe, de sus respaldos, revisiones, copias resguardadas y sincronización. El diseño de informes anteriores se conserva mientras no lo personalices.

## Guardar un formato reutilizable

En el editor de estructura, abre «Reutilizar como plantilla de empresa», escribe un nombre y pulsa «Guardar como plantilla nueva». Se copian la estructura, las definiciones de mediciones/verificaciones y los bloques/requisitos de la plantilla de origen. No se copian lecturas, notas de inspección, datos del cliente, fotografías, firmas ni el contenido de las secciones propias. Los textos de encabezado/pie y títulos configurados sí forman parte del formato.

Encontrarás la plantilla en **Plantillas de tu empresa**. Los informes nuevos tienen una copia independiente de su estructura. Con cuenta conectada, administrador y supervisor pueden crear plantillas de empresa. Sin conexión se guardan localmente y su subida depende de los permisos del usuario.

## Accesos rápidos y apariencia

- ★ / ☆ marca plantillas base o propias como favoritas. «Solo favoritas» acota la selección. Estas preferencias se guardan en este dispositivo para la empresa activa; no se sincronizan ni sustituyen un respaldo de informes.
- La lupa abre «Buscar y navegar»: secciones e informes recientes de la empresa activa. Ctrl/⌘+K es el atajo equivalente.
- Ctrl/⌘+S guarda el borrador; dentro de Estructura aplica los ajustes del formulario. Otros formularios se deben aplicar o cerrar primero.
- Claro, Oscuro y Dispositivo se eligen en la barra superior. La preferencia permanece en ese navegador. Los documentos mantienen fondo de papel y marca profesional.

Consulta `docs/REVISION_3.5.md` para las pruebas y la validación pendiente en tu entorno Cloudflare. El ZIP no realiza el despliegue por sí mismo.
