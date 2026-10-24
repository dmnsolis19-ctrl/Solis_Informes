# Actualizar a SOLIS Field Pro 3.2.0

1. Desde cada navegador con trabajo local, guarda los cambios y descarga un respaldo antes de actualizar.
2. Descomprime el ZIP y copia su contenido en la raíz de tu proyecto, reemplazando los archivos correspondientes. Incluye completos `public`, `worker`, `scripts`, `tests` y los archivos de la raíz.
3. Conserva tu `wrangler.jsonc`, el nombre del Worker, los IDs de D1, el bucket R2 y los bindings/secrets actuales. El paquete excluye ese archivo para evitar reemplazar tu configuración.
4. Desde 3.1.0 no hay una migración nueva de D1 ni de IndexedDB. Conserva las migraciones 0001, 0002 y 0003 existentes.
5. Ejecuta `npm run ci` con Node.js 24. No se añadieron dependencias npm.
6. Publica con tu flujo GitHub → Cloudflare habitual. Esta entrega no publica automáticamente en tu cuenta.
7. Abre la misma dirección y perfil del navegador que usabas. Guarda y recarga si había una versión anterior abierta; comprueba que la barra lateral indique `Field Pro · v3.2.0`.

## Comprobar la actualización

- En **Sincronización**, revisa la tabla de cambios de la empresa activa. Filtra errores, conflictos o solicitudes por revisar.
- Descarga un respaldo mientras tienes un borrador recién modificado; la descarga espera su guardado.
- Importa primero un respaldo de prueba. La vista previa indica qué se agregará y qué se conservará; aún puedes cancelar.
- Las solicitudes de aprobación o revisión recuperadas de un respaldo necesitan revisarse y solicitarse de nuevo desde el informe.
- Consulta el espacio estimado y solicita persistencia si el navegador la admite.
- En **Configuración y diagnóstico**, pulsa **Actualizar comprobaciones** para consultar al servidor. «Declarado por servidor» indica configuración presente; comprueba IA, PDF y correo desde sus funciones antes de usarlos en producción.

## Conservación de datos

La importación agrega registros nuevos; no sustituye registros existentes ni recupera versiones antiguas sobre ellos. No elimina datos. Si falta una empresa, cliente, equipo u otra referencia necesaria, o hay duplicidad de TAG o folio/revisión con otro ID, detiene la importación antes de guardar.

El respaldo usa formato 4 e incorpora las solicitudes de estado como contexto recuperable. No exporta sesiones, cuentas, cursores ni claves de acceso. La estimación de almacenamiento es del origen completo y puede variar según el navegador. Que se solicite una descarga no garantiza que el usuario haya guardado el archivo: comprueba tu carpeta de descargas.
