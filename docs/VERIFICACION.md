# Verificación de la entrega 3.0.0

Fecha: 23 de octubre de 2026.

## Resultado automático

`node scripts/ci.mjs`: **54 pruebas superadas**, sintaxis de **31 módulos** y compilación de **22 recursos locales**. Build de interfaz: `34ba469229e9`. No hay dependencias de CDN para abrir la interfaz, generar QR o decodificarlos.

Las pruebas usan SQLite real mediante un adaptador D1 y R2 en memoria. Los contratos de IA, transcripción, extracción y PDF se verifican con dobles de servicio. No se enviaron correos ni se consumieron servicios Cloudflare del usuario.

Cobertura:

- Nueve plantillas, validación de contenido, emisión, revisión, cálculo de propuestas y fecha local.
- Migraciones 0001 → 0002 → 0003 con documentos existentes: conserva registros, versiones, secuencia e historial, índices únicos y disparadores.
- Catálogos por empresa, TAG único, copia histórica, hallazgos, fotografías y secciones de plantilla.
- Bloques condicionales obligatorios, tablas, firmas, selecciones válidas y escape de contenido.
- Lecturas vacías, unidades, revisión más reciente, límites configurados, recurrencias y vencimientos.
- Tareas derivadas con IDs estables y propuestas sin precios ni trabajos inventados.
- QR generado y decodificado localmente por implementaciones independientes.
- Cookies HttpOnly, instalación única, origen de peticiones, cuentas y espacios independientes.
- Acceso por empresa, propiedad técnica, prohibición de falsificar aprobaciones y secuencia de revisión/aprobación/emisión.
- Petición de flujo repetida en concurrencia: un solo evento de auditoría.
- Emitido inmutable; nueva revisión sin firmas ni autorizaciones previas.
- Portal: excluye borradores y otros clientes; comentarios y anexos limitados al cliente correspondiente.
- R2 privado, impedimento de reutilizar archivos de otra empresa mediante sincronización o generación de PDF.
- PDF adjunto separado de D1 y reutilización de PDF emitido desde caché privada.
- Consulta limitada a fuentes autorizadas de la empresa y contratos de transcripción y PDF a texto revisables.
- Cambios concurrentes, confirmación de sync sin borrar modificaciones posteriores, tombstones y restauración.
- Sincronizador de la aplicación contra Worker y SQLite: crea empresa/cliente/informe/tarea en orden válido; recupera PDF a datos locales para uso sin red.
- Solicitud de estado offline permanece pendiente; se aplica tras sincronizar o se invalida si cambió el contenido.
- Caché de todos los módulos nuevos, navegación simulada sin red, exclusión de API/enlaces y activación controlada.
- Compatibilidad de lectura con clientes anteriores y rechazo de escrituras que perderían datos nuevos.

## Recorrido en navegador

Verificado en Chrome con datos de demostración conservados de la versión anterior:

1. Abre la versión 3 y muestra el panel y sus nuevos módulos.
2. Conserva cliente, instalación, equipo, plantilla y borrador de la versión 2.1.
3. Genera una tarea desde el hallazgo «Humedad en sello» y la presenta en seguimiento.
4. Guarda un procedimiento autorizado; consulta «humedad en bomba» y muestra fragmento, fuente y revisión.
5. Configura una plantilla con selección, campo condicional y tabla.
6. Crea un informe; al elegir modalidad Completa aparece el campo condicionado.
7. Guarda la redacción adicional y una fila de resultados. La vista previa A4 conserva los valores, tabla e identidad corporativa.
8. Revisa panel en contenedores de 390 y 768 px y formularios de tarea/orden: sin desbordamiento horizontal de página en las vistas examinadas.

Son contenedores de tamaño adaptable en Chrome, no teléfonos o tablets físicos. La previsualización interna usa HTTP. La PWA offline completa debe verificarse en HTTPS publicado o localhost; su ciclo se probó de forma simulada. Los permisos de roles y el portal se probaron por la API; no se realizaron sesiones de navegador con credenciales reales ni pruebas con cámara/micrófono físicos.

## Validación después de publicar en tu cuenta

1. Exportar respaldos locales y D1. Confirmar que 0003 se aplica sin cambiar el ID de D1 ni recrear el bucket.
2. Confirmar v3.0.0 en todos los dispositivos y revisar los permisos de cuentas anteriores.
3. Sincronizar computador ↔ teléfono con un cliente, equipo, plantilla avanzada, informe, fotos, PDF adjunto y tareas. Probar un conflicto de dos dispositivos.
4. Abrir con internet, desconectar, volver a abrir y guardar un borrador con tabla y evidencia. Reconectar con la app abierta y comprobar la recuperación.
5. Completar Borrador → En revisión → revisión técnica → Aprobado → Emitido con cuentas de los roles correspondientes. Probar devolución y nueva revisión.
6. Entrar como cliente desde otro perfil: comprobar que solo ve sus emitidos, descarga anexos y registra comentarios. Verificar que otra cuenta de cliente no accede.
7. Generar un PDF real con texto extenso, tabla, fotografías y firmas; revisar saltos, numeración y anexos separados.
8. Probar QR por cámara, imagen y TAG; grabación y transcripción con permiso de micrófono en Android/iOS usados en terreno.
9. Probar extracción de un PDF real, revisión y autorización del texto; evaluar citas y calidad de la IA con procedimientos propios.
10. Compartir por WhatsApp y correo; realizar un envío desde Resend si está configurado. Verificar caducidad y revocación de enlaces.
11. Descargar e importar respaldo en un perfil de prueba: comprobar informes, plantillas, tareas, órdenes, originales PDF, notas de voz y archivados.
12. Comprobar una actualización con un borrador abierto; confirmar guardado y recuperación antes de continuar.

Esta entrega contiene el código y las guías preparados para GitHub. No acredita un despliegue de esta versión ni una validación de esos servicios en la cuenta Cloudflare del usuario.
