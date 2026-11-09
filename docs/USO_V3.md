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


## Estructura avanzada, productividad y apariencia · 3.5

En un borrador, **Estructura del informe** permite ajustar el orden, los títulos, las secciones opcionales, el espaciado, las fotografías por fila y el encabezado/pie. Agrega secciones propias de párrafos/listas y solicita saltos de página. Los formatos Técnico, Ejecutivo e Inspección conservan el contenido al reorganizarlo. Aplica los cambios para guardarlos; cancelar descarta lo no aplicado. En emitidos se necesita una revisión.

«Reutilizar como plantilla de empresa» crea una plantilla nueva, independiente y con las secciones propias vacías. Conserva las definiciones de mediciones/verificaciones y los bloques/requisitos del origen, sin copiar datos del servicio. Se requieren permisos de administrador/supervisor para sincronizar plantillas.

En Plantillas, marca ★ para favoritas y usa el filtro. Las favoritas se guardan por empresa en ese dispositivo. La lupa o Ctrl/⌘+K abre el buscador de secciones e informes recientes. Ctrl/⌘+S guarda el borrador o aplica el formulario de estructura si está abierto.

El selector Claro/Oscuro/Dispositivo se encuentra en la barra superior y también en el portal del cliente. Su preferencia pertenece al navegador; el PDF mantiene el fondo de papel y la identidad de la empresa.

Recorrido de actualización y límites: `docs/releases/ACTUALIZAR_v3.5.0.md`.


## Gráficos, verificación y seguridad · 3.6

Los recorridos de gráficos y CSV, verificación pública, fotografías con hora y ubicación, dictado, verificación en dos pasos, tarea diaria y errores de dispositivos están descritos en `ACTUALIZAR_v3.6.0.md`.

## Planner de mantenimiento

«Planner» (menú, antes de «Órdenes y mantenimiento») lista las visitas pendientes por urgencia: «Vencidos», «Hoy», «Esta semana» y «Próximos 30 días». Se filtra por técnico, cliente y equipo; las visitas sin responsable muestran «Sin técnico» y los planes en pausa se avisan en la lista.

### Crear un plan

1. Pulsa «Crear plan», escribe el nombre del plan (obligatorio) y elige uno o más equipos. Con varios equipos se crea un plan por equipo; un equipo puede tener varios planes.
2. Define la fecha ancla, que es la fecha de la primera visita, y la periodicidad en días. El calendario es fijo: las visitas caen en ancla + n × días, sin importar cuándo se hicieron las anteriores.
3. Opcionalmente indica técnico por defecto, plantilla de informe y alcance.

Cada plan permite editar, «Pausar», «Reanudar» y «Cerrar plan». Al cerrar un plan se cancelan sus visitas futuras en estado Planificada (con motivo «plan cerrado»); no se tocan las visitas con edición manual, En curso, Completadas ni las de fechas pasadas, y nunca se borran. Un plan cerrado no se reabre. Editar la ancla o la periodicidad de un plan activo regenera las visitas futuras; reanudar uno pausado las reconcilia.

### Ciclo de una visita

- Las visitas se crean por adelantado, 90 días desde hoy, como órdenes individuales «Planificada». Las crea el Planner al abrirse y tras sincronizar, solo en dispositivos de administrador o supervisor (o en modo local sin cuenta conocida). El Planner lista todas las visitas de la empresa; los técnicos solo pueden iniciar las asignadas a ellos y las que no tienen responsable.
- «Iniciar visita» crea un informe de servicio prellenado (cliente, sitio, equipo, objetivo y alcance) con la plantilla del plan, o «Informe técnico general» si no tiene, y pasa la visita a «En curso». Después aparece «Abrir informe».
- Cuando el informe queda «Emitido» y un administrador o supervisor abre el Planner, la visita se cierra. Si se hizo a tiempo, el calendario no cambia. Si la fecha de servicio del informe es posterior a la programada, aparece «Esta visita se hizo con retraso» con dos opciones: «Mantener calendario» (por defecto) o «Correr calendario desde esta visita». Escape deja la visita «En curso».

### Correr calendario

Plan cada 30 días con ancla el 1 de marzo (visitas: 1 mar, 31 mar, 30 abr, 30 may); la visita del 31 de marzo se hace el 9 de abril, con retraso:

- «Mantener calendario»: las siguientes siguen el 30 de abril y el 30 de mayo.
- «Correr calendario»: la nueva ancla es el 9 de abril y las siguientes caen el 9 de mayo y el 8 de junio.
- Las visitas futuras planificadas sin edición manual se cancelan con motivo «calendario corrido» (no se borran) y se recrean desde la nueva ancla; el plan guarda el historial de anclas.

### Roles y sincronización

Administrador y supervisor generan visitas y cierran las completadas; el técnico solo puede iniciar las visitas asignadas a él o sin responsable (el Planner las lista todas) y abre los planes en solo lectura («Ver plan»: campos deshabilitados, próxima visita e historial de anclas, sin guardar). Los guardados no sobrescriben registros modificados en otro dispositivo. No hay migración de datos: el botón «Programar siguiente» de «Órdenes y mantenimiento» sigue disponible para órdenes sin plan; no se ofrece para planes del Planner ni para sus visitas. Los planes del Planner se editan desde el Planner (aunque se abran desde «Órdenes y mantenimiento»), no con el editor genérico. Al cambiar el técnico, la plantilla, el alcance o el nombre de un plan, las visitas futuras «Planificada» sin edición manual se actualizan; mover la fecha o cambiar el responsable de una visita a mano la marca como edición manual y el calendario ya no la cancela. El resumen diario por correo incluye las visitas del Planner (los planes no aparecen).

### Vista de calendario

Arriba de los filtros, el selector **Lista | Calendario** cambia la forma de ver las mismas visitas; la elección se recuerda en el dispositivo.

- El mes se muestra con la semana desde el lunes y los días de los meses vecinos atenuados. Cada día lista hasta 3 visitas (nombre y TAG) y «+N más». Colores: planificada neutra, en curso destacada, completada verde y vencida roja; las canceladas no se muestran.
- «Mes anterior», «Mes siguiente» y «Hoy» cambian de mes. Puedes ir a cualquier mes; los que no tienen visitas se ven vacíos.
- Los filtros de técnico, cliente y equipo se aplican también al calendario.
- Al pulsar un día (por defecto, hoy) se listan debajo todas sus visitas con las mismas acciones que la lista: «Iniciar visita», «Abrir informe» y «Abrir / editar».
- En el móvil, en lugar de las etiquetas cada día muestra un contador y el detalle está en la lista del día elegido.
- Abrir el calendario no genera ni cierra visitas distintas de las de la lista.

### Carga por técnico

El selector **Lista | Calendario | Carga** muestra en «Carga» una tabla con un responsable por fila. Las columnas son «Vencidas» (visitas abiertas con fecha anterior a hoy) y las 6 semanas que parten el lunes de la semana actual («Sem. 9 nov»). Cada celda es el número de visitas abiertas (Planificada o En curso) de ese responsable en esa semana; el tono es relativo al máximo de la tabla y el número siempre se ve.

- El responsable es la cuenta (se muestra su correo) o, si no hay, el nombre escrito; sin ninguno aparece «Sin técnico». Los filtros de técnico, cliente y equipo se aplican igual.
- Al pulsar una celda se listan debajo sus visitas (por fecha y prioridad) con las mismas acciones que la lista. Sin selección se lee «Elige una celda para ver sus visitas.»
- En el móvil la tabla se desplaza dentro de su recuadro y la columna del nombre queda fija.

### Reasignar una visita

Administradores, supervisores y el modo local ven «Reasignar» en las visitas Planificadas (lista, calendario y carga). El diálogo ofrece las personas de la empresa (correo y rol), «Sin técnico» y, sin sesión, un campo «Responsable». La visita queda con edición manual: «Correr calendario» y los cambios del plan ya no la tocan. Si la visita cambió en otro dispositivo o ya no está Planificada, se avisa sin guardar. Los técnicos no ven el botón: el servidor no les permite asignar visitas a otros.

### Limitaciones de la fase 1

- No hay vista semanal ni arrastrar para reprogramar visitas en el calendario; la carga por técnico no tiene capacidades configurables ni reasignación en bloque.
- No hay mantenimiento por horas de operación.
- No hay indicadores (cumplimiento, MTBF, MTTR), repuestos ni costos.
- El portal del cliente no cambia.
- El cierre automático requiere abrir el Planner en un dispositivo de administrador o supervisor; no hay cierre en segundo plano.
