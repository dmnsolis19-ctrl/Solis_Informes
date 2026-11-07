# Planner de mantenimiento (fase 1) — diseño

Fecha: 2026-11-07 · Estado: pendiente de revisión

## Objetivo

Convertir SOLIS Field Pro en un planner de mantenimiento preventivo para **la propia empresa de servicio**: planificar y dar seguimiento a las visitas recurrentes a los equipos de sus clientes, y cerrar cada visita con un informe de servicio.

Usuarios: el equipo interno (administrador, supervisor, técnicos). Los clientes no planifican; no se cambia el portal de clientes.

### Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Recurrencia | Calendario fijo: ancla + N días. |
| Visita atrasada | Al cerrarla se puede **correr el calendario** (nueva ancla = fecha de realización) o mantenerlo (por defecto). |
| Vista principal | Lista por urgencia: Vencidos, Hoy, Esta semana, Próximos 30 días; filtros por técnico, cliente y equipo. |
| Cierre | «Iniciar visita» crea un informe de servicio prellenado; al emitirlo la visita queda Completada. |
| Enfoque | **A**: un registro por ocurrencia, generadas por adelantado (horizonte 90 días). |

### Fuera de alcance (fase 1)

Calendario en rejilla, vista por carga de técnico, mantenimiento por horas de operación, indicadores (cumplimiento, MTBF/MTTR), repuestos y costos, cambios en el portal de clientes.

## Modelo de datos

No hay migración de esquema: se reutiliza `entities` con `kind='workOrders'` (`data` en JSON). `normalizeOperation` se amplía con campos nuevos, todos cadenas, como el resto de `operationFields`.

**Plan** (`type: 'Plan de mantenimiento'`):
- Existentes: `name`, `customerId`, `siteId`, `equipmentId`, `ownerId`, `intervalDays`, `scope`, `materials`, `notes`, `status`.
- Nuevos: `anchorDate` (AAAA-MM-DD), `planState` (`Activo` | `Pausado` | `Cerrado`), `anchorHistory` (JSON: lista de `{from, to, by, at, visitId}`).
- `dueDate` del plan no se usa para programar; la fecha viene de `anchorDate`.

**Visita** (`type: 'Orden de trabajo'`, hija de un plan):
- ID determinista: `visit-<planId>-<AAAAMMDD>`, truncado a 100 caracteres.
- Nuevos: `planId`, `scheduledDate` (se usa `dueDate` existente), `manualEdit` (`'1'` si alguien movió fecha o técnico a mano), `closedReason` (p. ej. `calendario corrido`).
- Estados existentes: Planificada, En curso, Completada, Cancelada.
- `reportId` enlaza el informe de servicio ya existente.

Se valida que `planId` apunte a un plan de la misma empresa y que `anchorDate`/fechas tengan formato válido, igual que `dueDate` hoy.

## Lógica (módulo nuevo `public/js/planner.js`, funciones puras)

- `ensureOccurrences(plan, visits, today, horizonDays = 90)` → lista de visitas por crear. Calcula `anchorDate + k·intervalDays` dentro de `[today, today + horizonDays]`, omite fechas con visita existente (cualquier estado) y no genera nada si el plan está Pausado/Cerrado o el equipo está dado de baja. Idempotente por ID determinista.
- `closeVisit(plan, visits, visit, doneDate, mode)` con `mode` en `'keep' | 'shift'`:
  - `keep`: el plan no cambia; solo se repone el horizonte.
  - `shift`: `anchorDate = doneDate`; se agrega entrada a `anchorHistory`; las visitas futuras en Planificada y sin `manualEdit` pasan a Cancelada con `closedReason='calendario corrido'`; se generan las nuevas desde la ancla. Las visitas En curso o con `manualEdit` se respetan.
  - Solo se programa hacia adelante: nunca se generan visitas en fechas pasadas.
- `urgencyBuckets(visits, today)` → `{overdue, today, week, next30}`; ordenadas por fecha y prioridad.
- Todas las fechas son AAAA-MM-DD en la fecha local de la empresa (como `localDate`), sin horas.

## Interfaz

- Nueva sección **Planner** (lista por urgencia) con filtros por técnico, cliente y equipo; marca visual para visitas sin técnico y planes pausados. Se sigue el patrón de lista de `page-patterns` y los componentes existentes de `workspace-ui.js`.
- Acciones por visita: **Iniciar visita** (crea informe de servicio prellenado con cliente, sitio, equipo y alcance, y deja la visita En curso), reprogramar y reasignar (marcan `manualEdit`).
- Al emitir el informe de una visita con fecha de realización posterior a la programada, un diálogo pregunta **Mantener calendario** (por defecto) o **Correr calendario desde esta visita**. Si no está atrasada, no se pregunta.
- Formulario de plan: equipo(s), ancla, periodicidad, técnico por defecto, alcance. Se puede aplicar un mismo plan a varios equipos (crea un plan por equipo).

## Sincronización y trabajo sin conexión

- La generación y el corrimiento ocurren **en el cliente** (al abrir el Planner y al cerrar una visita) y se sincronizan por el protocolo de mutaciones existente. El job diario del Worker no escribe visitas en fase 1; solo lee para el resumen de pendientes, ampliado a «visitas de hoy y vencidas». Así se evita que el servidor compita con los dispositivos por versiones y `mutation_id`.
- Dos dispositivos que generan a la vez producen los mismos IDs, así que no hay duplicados. Si ambos corren el calendario a la vez, prevalece el cambio con la versión más reciente; las visitas sobrantes quedan Canceladas por `calendario corrido`, no se borran.
- Un corrimiento hecho sin conexión se concilia al sincronizar con la regla anterior.

## Errores y casos borde

- Plan pausado/cerrado o equipo dado de baja: no se generan visitas nuevas; las existentes se muestran con aviso.
- Visita sin técnico: se lista con marca, no se bloquea.
- Informe devuelto o anulado: la visita vuelve a En curso.
- Cierre atrasado varias veces: no se generan visitas intermedias pasadas.
- Cambio de `intervalDays` o `anchorDate` del plan: regenera las futuras Planificadas sin `manualEdit`, con el mismo criterio que `shift`.
- Auditoría: el corrimiento y los cambios de plan usan `audit_events` existente.

## Pruebas

Estilo actual (`node --test`, carpeta `tests/`):
- `ensureOccurrences`: horizonte, idempotencia, planes pausados, equipo de baja, ancla en el pasado.
- `closeVisit`: `keep` y `shift`; respeto de `manualEdit` y visitas En curso; sin fechas pasadas; historial de anclas.
- `urgencyBuckets`: bordes de hoy, semana y 30 días.
- `normalizeOperation`: campos nuevos y referencias inválidas.
- Sincronización: generación simultánea desde dos dispositivos y corrimiento concurrente.
- E2E (`npm run e2e`): crear plan → ver visitas en el Planner → iniciar visita → emitir informe atrasado → correr calendario → ver visitas nuevas.

## Riesgos

- `normalizeOperation` valida con tablas de campos; agregar campos exige actualizar `operationFields` y las validaciones del Worker (`worker/validation.js`) en el mismo cambio.
- Si el volumen de planes crece mucho, filtrar en el cliente sobre `entities` puede resultar lento; en ese caso, una tabla de índice sería una mejora posterior.
