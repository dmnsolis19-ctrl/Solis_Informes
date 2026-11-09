# Planner · carga por técnico, reasignar y cierre de pendientes — diseño

Fecha: 2026-11-09 · Estado: decidido por el responsable del producto («continua con las mejoras»). Versión objetivo: **3.9.0**. Sin migraciones ni campos de datos nuevos.

## A. Pendientes conocidos de 3.8.0

1. **Plan en solo lectura para técnicos.** Hoy, un técnico que pulsa «Abrir / editar» sobre un plan del planner ve el error «Tu rol no permite administrar planes». Debe ver el plan **en solo lectura**: nombre, equipo, fecha ancla, periodicidad, técnico por defecto, plantilla, alcance, estado del plan (activo/pausado), próxima visita y, si existe, el historial de anclas (fecha anterior → nueva); campos deshabilitados, sin botones de guardar, y un texto «Solo un administrador o supervisor puede editar este plan.» con botón «Cerrar». Administradores, supervisores y el modo local siguen con el diálogo de edición de siempre.
2. **Rol guardado al cerrar sesión.** Al cerrar sesión (`logout` en `public/js/sync.js`) se guarda `lastRole='none'`, de modo que un dispositivo compartido sin conexión ya no trata «sin sesión» como modo local de quien lo usó antes. Un inicio de sesión posterior vuelve a escribir el rol real (comportamiento actual de `checkSession`). `canGenerateVisits(null,'none')` ya es falso; no cambia el modo local de dispositivos que nunca iniciaron sesión (`lastRole` vacío).

## B. Carga por técnico y reasignar

### Vista «Carga»
- Tercera opción del selector del Planner: **Lista | Calendario | Carga** (se recuerda en `solis.plannerView`, mismas reglas de `try/catch`).
- Tabla de **técnicos × semanas**: una fila por responsable que tenga visitas abiertas en el rango, más la fila «Sin técnico»; columnas: «Vencidas» (visitas abiertas con fecha anterior a hoy) y las **6 semanas** que empiezan en el lunes de la semana actual (encabezado «Sem. 9 nov», fecha del lunes). Cada celda muestra el número de visitas **abiertas** (Planificada o En curso) de ese responsable en esa semana; vacía = «0» atenuado.
- Intensidad por celda relativa al máximo de la tabla (4 niveles: 0, bajo, medio, alto) con texto visible (no solo color) y `title`/`aria-label` («Ana Pérez, semana del 9 de noviembre: 5 visitas»). Sin umbrales de capacidad configurables en esta fase.
- Responsable = `ownerId` (se resuelve a correo/nombre con `state.people` cuando exista) o, si no, el texto `owner`; visitas sin ninguno → «Sin técnico». Mismos filtros de cliente y equipo que las otras vistas (el filtro de técnico filtra filas) y mismo alcance por empresa.
- Pulsar una celda (o «Vencidas») la **selecciona** y debajo de la tabla se listan las visitas de esa celda con las mismas tarjetas y acciones que la lista, ordenadas por fecha y prioridad. Sin selección, texto guía: «Elige una celda para ver sus visitas.»
- Móvil (≤ 600 px): la tabla se desplaza dentro de su contenedor (`overflow-x:auto`, la página no); primera columna fija con el nombre del técnico.
- Accesibilidad: celdas `button` con `aria-pressed` en la selección; tabla con `th scope` y encabezados; foco visible; teclado Tab/Enter.

### Reasignar
- Botón **«Reasignar»** en la tarjeta de toda visita `Planificada` (lista, calendario y carga), visible solo para administrador/supervisor (y modo local con `canGenerateVisits`); los técnicos no lo ven (el Worker rechaza asignar a otros con 403).
- Diálogo «Reasignar visita»: lista de personas de la empresa (`state.people`, correo y rol; se carga con `/api/people?companyId=` si hay sesión y conexión, como el diálogo de planes), opción «Sin técnico», y en modo local un campo de texto «Responsable». Botón «Reasignar» (verbo primero) y «Cancelar». Escape cierra sin cambios.
- Efecto: actualiza `ownerId` y `owner`, y marca `manualEdit='1'` (la visita queda protegida de «Correr calendario» y de las ediciones del plan). Sin cambios si se elige el mismo responsable.
- **Concurrencia:** se guarda sobre el registro del estado (con su `_sync`) para que `saveEntity` detecte que cambió en otro dispositivo; si está en conflicto o ya no es `Planificada`, se muestra «Esta visita cambió en otro dispositivo. Actualiza la pantalla e inténtalo de nuevo.» sin escribir. Anti doble clic (botón deshabilitado mientras guarda). Una función pura `reassignVisit(visit, person) → visit | null` (null si no hay cambio o no es `Planificada`) con pruebas.

## Modelo (módulo puro en `public/js/planner.js`)
- `workloadTable(visits, today, people, filters?, weeks = 6) → {weeks: [{monday, label}], rows: [{key, name, overdue, cells: number[], total}], max}`: filas ordenadas por nombre con «Sin técnico» al final; solo visitas abiertas con `dueDate` válida; lunes de la semana de `today` calculado con enteros UTC (sin dependencia de la zona horaria del dispositivo, igual que `monthGrid`); visitas fuera del rango no cuentan; no muta las entradas.
- `workloadCell(visits, today, people, key, weekIndexOrOverdue, filters?) → visit[]` para listar la celda seleccionada con el mismo criterio.
- `reassignVisit(visit, person)` como arriba, y `markManualEdit` existente.

## Pruebas
- Unitarias: `workloadTable` (semana que empieza el lunes, domingo cuenta en la semana anterior, visita en el límite de 6 semanas, vencidas, «Sin técnico», resolución de `ownerId` con y sin `people`, estados cerrados excluidos, filtros, orden, máximo), `workloadCell`, `reassignVisit` (cambia dueño y `manualEdit`; mismo responsable → null; Completada/En curso → null; no muta), lectura de plan en solo lectura (función pura que prepara los datos), `lastRole='none'` al cerrar sesión.
- Navegador: alternar a «Carga» y ver una visita en la celda correcta; seleccionar la celda y ver la tarjeta; reasignar una visita (supervisor) y comprobar que cambia de fila, que `manualEdit` queda en '1' y que un técnico no ve «Reasignar»; plan en solo lectura para técnico (campos deshabilitados, sin guardar); sin desbordamiento horizontal de la página a 375 px; fechas relativas a hoy (no fijas).

## Fuera de alcance
Capacidad por técnico configurable, arrastrar para reasignar, reasignación en bloque, indicadores de cumplimiento, mantenimiento por horas.
