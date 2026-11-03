# Revisión de SOLIS Field Pro 3.5.0

Fecha: 28 de octubre de 2026.

## Procedencia y conservación

Base recibida: `SOLIS_Field_Pro_v3.4.0(1).zip` (282827 bytes).

SHA-256 de la base: `67cf1029512ca0ae8f91c97453660d4e1e6f7b64bf16ab728cc7f72afb761fd3`.

Se conservan todos sus archivos funcionales, las trece bases, protección de borradores, copias resguardadas, restauración idempotente, importación transaccional, roles, portal, JSONC y contratos de sincronización. Se amplían dominio, validación, representación e interfaz para la estructura de informe; no se sustituye la persistencia por la de una entrega antigua.

No hay cambios de esquema D1/IndexedDB. La nueva información es adicional en el JSON de informes y plantillas. Se mantiene la lectura de sincronización 4; la capacidad de escritura 5 impide que clientes anteriores eliminen estructuras nuevas.

## Resultado automático

`node scripts/ci.mjs`: **95 pruebas superadas**, sintaxis de **51 módulos** y compilación de **32 recursos locales**. Build `16946bb52840`.

Las 84 pruebas recibidas de la base se conservan y pasan. Se añaden pruebas de apariencia, estructura, PDF, reutilización sin contenido del origen, respaldo/importación, compatibilidad de escritura y búsqueda por empresa.

- Estructura: valida IDs, límites, duplicados, tipos y presencia/visibilidad de secciones esenciales.
- HTML/PDF: orden y títulos, ocultación opcional, saltos, espaciado y columnas de fotos; texto escapado en párrafos/listas. Contrato de PDF de servidor con contenido personalizado.
- Formatos: orden predefinido sin perder notas; copia independiente por informe; plantilla con notas propias vacías.
- Conservación: normalización, revisión, respaldo con IndexedDB de frontera e importación; rechazo de estructuras malformadas antes de escribir.
- Worker/SQLite: persistencia de estructura, validación y rechazo 426 a escrituras de clientes antiguos; reglas anteriores de permisos y emisión.
- Productividad: búsqueda sin acentos solo en empresa activa; el rol Cliente no puede abrir el buscador interno del equipo.
- Tema: aplicación inicial, persistencia, seguimiento del sistema, pestañas y almacenamiento bloqueado. Nuevos archivos precargados para uso offline.

## Revisión de interfaz

Chrome, datos de demostración y previsualización local:

- Cambio Claro/Oscuro y persistencia tras recargar.
- Navegación por las trece bases y creación de un borrador HVAC.
- Formato Ejecutivo, sección propia con título y contenido, espaciado compacto, guardado como plantilla y aplicación al documento.
- Vista previa con el título personalizado; el documento tiene su presentación independiente de la interfaz oscura.
- Favorito de una plantilla propia, filtro de favoritas y creación de otro informe con la sección propia vacía.
- Buscador rápido y navegación al centro de sincronización/copias resguardadas.
- Contenedores de 390 y 768 px para el panel y 390 px para el editor de estructura: sin desbordamiento horizontal de página en los puntos examinados. No equivalen a pruebas en dispositivos físicos.

## Pendiente en tu nube

No se desplegó en tu cuenta ni se consumieron IA/PDF/correo reales. Los contratos de proveedores se comprobaron con dobles. Valida la sincronización entre dos dispositivos, actualización de PWA en HTTPS, impresión/PDF con informes largos, saltos de página y fotos, portal y permisos en tu entorno. Los favoritos pertenecen al dispositivo; la estructura y las plantillas sí forman parte de los registros sincronizados y respaldados.
