# Incorporaciones de 3.4.0

En Plantillas, usa el buscador y filtro para elegir climatización, electricidad, automatización, fotovoltaica u otra base. Continúa creando plantillas propias para nuevos servicios; no se necesita modificar el código para adaptar bloques, mediciones, verificaciones y textos dentro de sus capacidades actuales.

En el editor, el recorrido Preparar → Revisar → Aprobar → Entregar abre los controles existentes. Si aparece un aviso de edición simultánea, tu texto queda en Sincronización → Copias resguardadas y el informe muestra la versión que se guardó primero. Puedes recuperar la copia como otro informe; necesita revisión y firmas propias. Los respaldos incluyen estas copias.

---

# Uso de SOLIS Field Pro 3

## Empresa y documentos

Completa razón social, identificación, contacto, dirección, logo y colores en «Empresas y marca». Selecciona la empresa activa antes de crear registros. Cada informe conserva sus datos corporativos; los cambios de marca posteriores no reescriben lo entregado.

Registra clientes, instalaciones y activos. Usa un TAG único por empresa. Desde el historial del equipo crea una intervención y elige la plantilla: se copian el cliente, ubicación y datos técnicos. Los informes antiguos no se vinculan por coincidencias de nombre; vincula un borrador o crea una revisión del emitido.

## Diseñador

En «Plantillas → Configurar» define base, orden, campos y secciones. Agrega bloques de texto, número, fecha, selección, tabla, fotografía o firma. Para selección y tablas, separa opciones o columnas con `|`. Una tabla admite hasta ocho columnas y cien filas; una plantilla, hasta cuarenta bloques.

Para una condición, elige el campo controlador en «Mostrar cuando el campo…» e ingresa su valor exacto en «…es igual a». Si marcas el bloque como obligatorio, solo será obligatorio cuando se muestre. Fotografía permite seleccionar una evidencia del informe. Firma utiliza la firma del responsable o del cliente en «Revisión».

Los cambios guardados se aplican a informes nuevos. Los existentes conservan su copia. «Versiones» consulta el historial sincronizado y permite crear un informe con una configuración anterior; requiere conexión.

## Trabajo en terreno y respaldo

Abre la app con internet antes de salir. Confirma «Cambios sincronizados». Puedes crear borradores, editar catálogos y plantillas, registrar evidencias, consultar texto autorizado ya descargado, leer QR y registrar tareas sin red. El navegador guarda los datos en este dispositivo y perfil.

La recuperación de internet inicia la sincronización con sesión activa y la app abierta. Cada archivo se envía por separado y el contenido ya enviado se reutiliza; los registros tienen versión e identificador de cambio. Un conflicto se compara y resuelve explícitamente. Si otro usuario cambió un informe, la aprobación pendiente no sobrescribe ese cambio.

Usa «Descargar respaldo» con regularidad. Incluye registros operativos, plantillas, archivos, notas de voz locales y elementos archivados. Importar incorpora IDs nuevos y conserva los existentes. Los audios no se sincronizan como evidencias; el texto aceptado sí forma parte del informe. Los estados de aprobación pendientes y las sesiones no se transfieren mediante respaldo.

El almacenamiento pertenece al origen web. Usa un perfil del navegador para cada cuenta con trabajo offline. Cerrar sesión conserva la copia local. No utilices el mismo perfil para entrar con distintas cuentas de campo. La aplicación bloquea la sincronización cruzada; no borra por sí misma la copia de una cuenta anterior.

## QR y voz

En el historial pulsa «Etiqueta QR» para descargar el SVG y colocarlo en el activo. El QR identifica el equipo y abre esta aplicación; no contiene credenciales. «Escanear equipo» permite cámara, imagen o búsqueda por TAG. El equipo debe estar en los catálogos descargados de la empresa activa. La cámara requiere HTTPS o localhost y permiso del dispositivo.

En un borrador, abre «Notas por voz». Graba hasta tres minutos o carga audio de hasta 4 MB. Detener guarda el audio localmente. Solo «Transcribir con IA» lo envía a Workers AI. Revisa el texto y decide en qué sección incorporarlo. Micrófono y grabación dependen del navegador y sus permisos; cargar audio es la alternativa. No se realizaron pruebas con micrófonos o cámaras físicos en esta entrega.

## Revisión, aprobación y auditoría

El nuevo documento comienza en Borrador. «Enviar a revisión» solicita un cambio de estado al servidor. Una solicitud offline no cambia el estado documental hasta ser validada online. No edites el contenido después de solicitar un estado; si cambia, revisa y vuelve a solicitarlo.

Un supervisor o aprobador registra la revisión técnica. Un aprobador autoriza y emite. El autor no puede revisarse o aprobarse por esos roles; el administrador puede completar el circuito individualmente y la excepción queda registrada. Para corregir En revisión o Aprobado se requiere devolver a Borrador con motivo. Emitido está bloqueado; «Crear revisión» conserva la versión anterior y elimina firmas y aprobaciones previas.

«Revisión de coherencia» comprueba contenido mínimo, límites configurados, hallazgos pendientes frente a resultado Conforme y responsables. Es una revisión de reglas; no acredita el cumplimiento de una norma técnica. «Auditoría y comentarios» muestra los últimos 200 eventos de la empresa y los últimos 100 comentarios del portal, según permisos.

## Roles y organizaciones

| Rol | Operaciones principales |
|---|---|
| Administrador | Usuarios y organizaciones, todas las empresas del espacio, configuración y circuito documental completo |
| Técnico | Borradores propios/asignados, datos de terreno, tareas propias y envío a revisión dentro de sus empresas |
| Supervisor | Configuración técnica de empresas permitidas, plantillas, manuales, asignación de tareas y revisión/devolución |
| Aprobador | Revisión, aprobación, emisión y devolución dentro de sus empresas |
| Cliente | Portal de su ficha: emitidos, anexos, acciones y comentarios; sin sincronización general |

Los usuarios anteriores con rol Editor funcionan como técnicos. La lectura técnica interna se comparte dentro de las empresas permitidas; la propiedad restringe las escrituras de informes y tareas. La separación por empresa se aplica en la API, incluyendo archivos, no solo en los menús.

«Equipo y servicios → Administrar usuarios» permite crear cuentas y restringir empresas, rol, cliente y estado activo. Cambiar el acceso cierra las sesiones del usuario. El administrador actual no puede deshabilitarse desde este formulario. La distribución de credenciales iniciales es manual; no se envían invitaciones automáticas.

«Crear organización independiente» crea un espacio distinto y su administrador en el mismo despliegue. No copia datos de la organización actual. Su administrador entra desde otro perfil del navegador. No incluye planes de suscripción ni cobros.

## Alertas y seguimiento

Crea reglas de Medición con parámetro, unidad y límite; Recurrencia con título de falla, cantidad y días; o Vencimiento con ventana de días. Define los límites a partir del equipo y procedimiento aplicable. No se proporcionan valores técnicos universales inventados.

Las mediciones vacías no son cero. Las tendencias comparan parámetro y unidad, sin convertir automáticamente bar a kPa. La alerta de medición utiliza la lectura más reciente registrada del activo; las recurrencias cuentan intervenciones diferentes, no revisiones duplicadas del mismo folio.

«Crear tareas desde pendientes» copia hallazgos y acciones a seguimiento independiente, sin duplicar los mismos IDs de origen. Cerrar una tarea requiere evidencia de cierre y no cambia el informe emitido. Una tarea aún pendiente no se vuelve a crear al pulsar el botón.

Desde un documento Aprobado o Emitido, «Generar documento relacionado» prepara una propuesta, orden o plan. Una propuesta comienza sin precios ni actividades inventadas. Una orden describe trabajo planificado; no acredita ejecución. En los planes, define fecha y periodicidad, y pulsa «Programar siguiente» para crear la próxima intervención. Las alertas se ven al abrir el panel; no hay avisos programados automáticos por correo o WhatsApp.

## Biblioteca e IA

Un administrador o supervisor incorpora el texto de procedimientos, su fuente, revisión y alcance, y lo marca Autorizado después de revisarlo. Puedes pegar texto, importar TXT/Markdown, adjuntar PDF de hasta 2 MB o extraer su texto con Workers AI. Extraer no autoriza automáticamente. El original queda en almacenamiento privado.

La consulta recupera hasta cinco fragmentos de documentos Autorizados de la empresa activa. Muestra título, revisión y referencia. No es un buscador vectorial de una colección ilimitada; utiliza coincidencias de texto. Con IA configurada puede redactar una respuesta usando esos fragmentos. Revisa las citas y el contenido antes de «Agregar texto y fuentes al borrador». El informe conserva los fragmentos aceptados.

El asistente de redacción recibe los datos textuales del informe y propone cambios editables. Las consultas envían pregunta y fragmentos autorizados; la transcripción envía audio; la conversión envía el PDF elegido. Solo ocurren al usar los botones correspondientes. La IA no modifica por sí misma un emitido ni aprueba documentos.

## Portal y entrega

Crea un usuario Cliente vinculado a su ficha y empresa. Al entrar verá sus informes y propuestas Emitidos, sus anexos PDF y tareas asociadas. Puede dejar un comentario; el equipo lo consulta en Auditoría. El portal necesita conexión para verificar acceso y vigencia. No obtiene la base offline interna.

Los informes admiten hasta cuatro anexos PDF de 2 MB cada uno. Se conservan en el dispositivo y en R2 privado al sincronizar. Se enumeran como anexos; no se fusionan automáticamente como páginas del PDF del informe. El cliente los descarga por separado desde el portal.

PDF directo necesita BROWSER. El PDF emitido se reutiliza desde R2 privado según el contenido renderizado. «Imprimir / Guardar como PDF» funciona con los recursos locales preparados. Los enlaces de entrega duran siete días y se pueden revocar. WhatsApp abre el mensaje o el menú de compartir para que confirmes el envío. Resend requiere remitente y credenciales configurados; el correo entrega un enlace, sin envío automático de todos los anexos. No hay integración desatendida con WhatsApp Business.
