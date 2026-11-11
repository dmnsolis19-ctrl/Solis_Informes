# Planner · indicadores de cumplimiento — diseño

Fecha: 2026-11-11 · Estado: decidido por el responsable del producto («continuemos con las siguientes mejoras»). Versión objetivo: **3.10.0**. **Sin migraciones ni campos de datos nuevos**: todo se calcula en el cliente a partir de las visitas (`workOrders` con `planId`) y de sus informes vinculados.

## Objetivo

Quien dirige el servicio ve si el mantenimiento preventivo se cumple: qué porcentaje de las visitas programadas se realizó, cuántas a tiempo, cuánto se atrasan en promedio, quién tiene más vencidas y cómo evoluciona mes a mes. Hoy el Planner solo muestra lo pendiente; no hay forma de medir lo ya ocurrido.

## Decisiones

- **Cuarta vista del Planner: «Indicadores»** (Lista | Calendario | Carga | Indicadores), recordada en `solis.plannerView` con las mismas reglas de `try/catch` y de valor inválido → Lista. Visible para todos los roles que ya ven el Planner (no clientes); solo lectura, sin escrituras ni generación.
- **Período:** selector «Últimos 30 días | 90 días | 180 días» (por defecto 90, solo en `state`, no se persiste). La ventana es `[hoy − (N−1), hoy]` por **fecha programada** (`dueDate`), calculada con aritmética entera UTC como `monthGrid` (sin dependencia de zona horaria ni del cambio de hora).
- **Qué cuenta (visitas «medibles»):** visitas de planes con `dueDate` válida dentro de la ventana y estado `Completada`, o `Planificada`/`En curso` **ya vencida** (`dueDate < hoy`). Se excluyen `Cancelada` y las futuras (incluida la de hoy si sigue abierta: aún no está vencida). Mismos filtros que las otras vistas (técnico, cliente, equipo) y mismo alcance por empresa.
- **Fecha de realización** de una visita `Completada` = `serviceDate` de su informe vinculado (`reportId`, no borrado). Sin informe vinculado o con fecha inválida → «realizada, fecha desconocida»: cuenta como completada pero no entra en puntualidad ni en atraso.
- **Definiciones:**
  - *Cumplimiento* = completadas ÷ medibles.
  - *Puntualidad* = completadas con fecha conocida y `serviceDate ≤ dueDate` ÷ completadas con fecha conocida.
  - *Atraso promedio* = promedio de días (`serviceDate − dueDate`) de las completadas tardías; «—» si no hay.
  - *Vencidas abiertas* = visitas abiertas con `dueDate < hoy` (de **toda** la ventana) y *la más antigua* (días de atraso).
  - Porcentajes enteros redondeados; si el denominador es 0 se muestra «—» (nunca «0 %» ni «NaN»).
- **Qué se muestra:**
  1. Tarjetas: Cumplimiento, Puntualidad, Atraso promedio, Vencidas abiertas (con la más antigua), y «Visitas medidas: N».
  2. **Tabla por técnico** (mismo criterio de agrupación y de etiquetas que «Carga», incluida la fila «Sin técnico»): medibles, completadas, a tiempo, tardías, abiertas vencidas, cumplimiento %; ordenada por cumplimiento ascendente (los peores arriba), luego por nombre.
  3. **Evolución mensual** de los últimos meses que toca la ventana (hasta 7): por mes de la fecha programada, barras horizontales con el porcentaje de cumplimiento y el texto «completadas de medibles» (el número siempre visible; las barras nunca son lo único que informa).
  4. Botón **«Exportar CSV»** con el detalle de las visitas medidas de la ventana (columnas: fecha programada, fecha realizada, estado, días de atraso, plan, equipo, técnico). Separador `;`, UTF-8 con BOM, comillas escapadas, y celdas que empiezan por `=`, `+`, `-`, `@` o tabulación se prefijan con `'` (inyección de fórmulas). Nombre de archivo `planner-indicadores-AAAA-MM-DD.csv`. Usa el mecanismo de descarga ya existente en la app.
- **Sin datos:** estado vacío claro («Aún no hay visitas vencidas o completadas en este período.») con indicación de que las visitas aparecen aquí cuando pasan su fecha o se cierran.
- **Móvil (≤ 600 px):** tarjetas en una o dos columnas; la tabla se desplaza dentro de su contenedor (no la página); sin desbordamiento horizontal de la página. Accesibilidad: `th scope`, tarjetas con texto completo (no solo números sueltos), barras con `role="img"` y `aria-label`, selector de período como grupo de botones con `aria-pressed`, tema oscuro con contraste suficiente, sin animaciones nuevas.

## Modelo (módulo puro en `public/js/planner.js`)

- `complianceStats(visits, reports, today, days, people, filters?) → {from, to, days, measured, completed, onTime, late, unknownDate, openOverdue, oldestOverdueDays, compliancePct, punctualityPct, avgLateDays, rows, months, details}`:
  - `rows`: `[{key, name, measured, completed, onTime, late, openOverdue, compliancePct}]` con el mismo agrupamiento que `workloadTable` (reutilizar su resolución de responsable: `ownerId` vía `people`, o texto `owner`, o «Sin técnico»; sufijo «(sin cuenta)» como allí).
  - `months`: `[{ym, label, measured, completed, pct}]` en orden cronológico, solo meses con al menos una visita medible o dentro de la ventana.
  - `details`: filas del CSV ordenadas por fecha programada.
  - No muta las entradas; ignora visitas sin `dueDate` válida; las de planes (`type 'Plan de mantenimiento'`) no cuentan.
- `complianceCsv(stats) → string` (con BOM, separador `;`, escape y protección de fórmulas).
- `completionDate(visit, reports) → 'YYYY-MM-DD' | ''`.

## Pruebas

- Unitarias (archivo nuevo `tests/planner-kpi.test.mjs`): ventana de 30/90/180 días con bordes (primer y último día, día anterior excluido, hoy abierto excluido, hoy completado incluido); medibles; cumplimiento, puntualidad y atraso promedio con casos exactos (incluida la visita realizada el mismo día de lo programado = a tiempo); fecha desconocida (sin informe, informe borrado, `serviceDate` inválida); `Cancelada` y planes excluidos; denominadores 0 → `null`; redondeo; filtros; por técnico (ownerId/texto/«Sin técnico», orden por cumplimiento ascendente y desempate por nombre); meses que cruzan año (dic→ene) y febrero bisiesto; no muta las entradas; CSV: BOM, separador, comillas, saltos de línea, prefijo anti-fórmula, nombre de archivo.
- Navegador: alternar a «Indicadores», ver tarjetas y tabla con valores exactos de un conjunto sembrado (visitas completadas a tiempo y tardías con informes de distintas fechas, una vencida abierta, una cancelada, una futura), cambiar el período y ver que cambian, exportar CSV (descarga) y comprobar su contenido, estado vacío, sin desbordamiento horizontal a 375 px. Fechas **relativas a hoy** (no fijas) y verificadas también con la fecha simulada (por ejemplo 2026-12-03 y 2027-01-02).

## Fuera de alcance

Metas o umbrales configurables, comparación entre períodos, gráficos con librerías, indicadores de MTBF/MTTR y costos, exportar a PDF, avisos automáticos de incumplimiento.
