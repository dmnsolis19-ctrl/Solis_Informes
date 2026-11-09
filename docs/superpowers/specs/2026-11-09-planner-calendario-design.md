# Planner · vista de calendario mensual — diseño

Fecha: 2026-11-09 · Estado: decidido por el responsable del producto («avanza con la siguiente mejora»), sin cambios de datos.

## Objetivo

Además de la lista por urgencia, quien planifica ve las visitas en un calendario mensual para repartir carga y detectar días saturados. Es una **segunda vista de los mismos datos** (`workOrders` con `planId`): no hay migraciones ni campos nuevos, y no cambia la sincronización.

## Decisiones

- **Selector «Lista | Calendario»** en la cabecera del Planner. La elección se recuerda por dispositivo en `localStorage` (clave `solis.plannerView`, con `try/catch`; sin almacenamiento funciona igual). Por defecto, Lista.
- **Mes en cuadrícula, semana desde el lunes** (es-CL): 7 columnas, 4 a 6 filas, días de los meses vecinos atenuados. Botones «Mes anterior», «Mes siguiente» y «Hoy». Se puede navegar a cualquier mes (el generador solo crea 90 días hacia adelante; los meses sin visitas se ven vacíos, sin error).
- **Contenido de cada día:** hasta 3 visitas como etiquetas (nombre; TAG del equipo si cabe) y «+N más». Estados: `Planificada` neutra, `En curso` destacada, `Completada` verde, vencida (Planificada/En curso con fecha < hoy) en rojo; las `Cancelada` no se muestran. Mismos filtros que la lista (técnico, cliente, equipo) y mismo alcance por empresa.
- **Día seleccionado:** pulsar un día lo selecciona (por defecto, hoy si está en el mes) y debajo de la cuadrícula se listan **todas** sus visitas con las mismas tarjetas y acciones que la lista («Iniciar visita», «Abrir informe», «Abrir / editar»). No hay arrastrar y soltar en esta fase.
- **Móvil (≤ 600 px):** las etiquetas se sustituyen por un contador por día; el detalle está en la lista del día seleccionado. Sin desplazamiento horizontal de la página.
- **Accesibilidad:** cada día es un `button` con `aria-label` («9 de noviembre de 2026, 2 visitas»); el día seleccionado usa `aria-pressed`; foco visible; navegación con Tab/Enter. Respetar `prefers-reduced-motion` (sin animaciones nuevas).
- **Sin generación nueva:** abrir el calendario no cambia cuándo se generan o cierran visitas (siguen `ensurePlannerVisits` y `closePendingVisits` al abrir el Planner).

## Modelo (módulo puro en `public/js/planner.js`)

- `monthGrid(visits, year, month, today, filters?) → {year, month, weeks: Day[][]}` con `Day = {date, inMonth, isToday, visits: visit[]}`. `month` es 1–12. Semanas de lunes a domingo. Solo visitas con `dueDate` válida y estado distinto de `Cancelada`; ordenadas por prioridad (`Crítica` > `Alta` > `Media` > `Baja`) y luego por nombre. Filtros `ownerId`, `customerId`, `equipmentId` como en `urgencyBuckets`. No muta las entradas.
- `shiftMonth(year, month, delta) → {year, month}` (cruza años).
- `visitTone(visit, today) → 'overdue'|'progress'|'done'|'planned'`.

## Pruebas

- Unitarias: lunes primero; meses de 28/29/30/31 días y febrero bisiesto; relleno de semanas; día con visitas en varios estados; `Cancelada` excluida; filtros; orden; `shiftMonth` en diciembre/enero; entradas sin mutar; `visitTone`.
- Navegador: alternar Lista/Calendario (y que se recuerde tras recargar), cambiar de mes, ver una visita en el día correcto, seleccionar un día y ver sus visitas, sin desbordamiento horizontal a 375 px.

## Fuera de alcance

Arrastrar para reprogramar, vista semanal, carga por técnico, exportar a calendario externo.
