# Planner de mantenimiento (fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Planner de mantenimiento preventivo para la propia empresa: planes con calendario fijo, visitas generadas por adelantado, lista por urgencia, «Iniciar visita» con informe de servicio y cierre que puede mantener o correr el calendario.

**Architecture:** Lógica de calendario en un módulo puro nuevo (`public/js/planner.js`) que devuelve conjuntos de cambios (crear/cancelar) sin tocar la base. La UI nueva (`public/js/planner-ui.js`) los persiste con `db.saveEntity('workOrders', …)`, que ya sincroniza offline. Planes y visitas son `workOrders`; el Worker las valida con el mismo `normalizeOperation`, así que no hay migración de esquema.

**Tech Stack:** JavaScript ES modules sin framework, IndexedDB (`public/js/store.js`), Cloudflare Worker + D1, `node --test`, Playwright (`npm run e2e`).

**Spec:** `docs/superpowers/specs/2026-11-07-planner-mantenimiento-design.md`

## Global Constraints

- Fechas siempre `AAAA-MM-DD` en fecha local (`localDate()` de `domain.js`); sin horas.
- Recurrencia de calendario fijo: ocurrencias en `ancla + k·intervalDays`; horizonte de generación **90 días**; `intervalDays` entre 1 y 3650 (validación existente).
- ID de visita determinista: `visit-<planId>-<AAAAMMDD>`, truncado a 100 caracteres.
- Estados de visita existentes: `Planificada`, `En curso`, `Completada`, `Cancelada`. Estados de plan nuevos en `planState`: `Activo`, `Pausado`, `Cerrado`; el `status` del plan sigue siendo `Planificada`.
- Al correr el calendario las visitas sobrantes se cancelan con `closedReason='calendario corrido'`; nunca se borran.
- Solo `admin` y `supervisor` generan, cancelan o corren visitas (el Worker rechaza con 403 que un técnico asigne a otro; `worker/enterprise.js` `assertWrite`). Sin sesión (modo local) se permite.
- Campos de texto de `normalizeOperation`: máximo 1000 caracteres, salvo `notes`, `scope`, `materials`, `resolution` y `anchorHistory` (20000).
- Textos de interfaz en español, verbo primero en botones («Iniciar visita», «Correr calendario»). Sin dependencias nuevas.
- Cada módulo nuevo debe quedar en la precarga offline (`public/sw.js` se regenera con `npm run build`).

## Review Focus

- Plan con `intervalDays` vacío, 0 o no entero → no genera visitas ni lanza error en la lista.
- Plan legacy (sin `anchorDate`, con `dueDate`) → usa `dueDate` como ancla.
- Ancla muy antigua (años atrás) → no genera visitas pasadas ni miles de registros.
- Técnico (no supervisor) abre el Planner → ve sus visitas pero no intenta generar ni correr (evita 403 en la cola de sincronización).
- Informe de la visita borrado o inexistente → «Iniciar visita» vuelve a estar disponible y no rompe la lista.

---

## File Structure

- Create `public/js/planner.js` — funciones puras de calendario (sin DOM ni base).
- Create `public/js/planner-ui.js` — vista Planner, formulario de plan, diálogo de cierre y acciones.
- Modify `public/js/operations.js` — campos nuevos de `workOrders` y su validación.
- Modify `public/js/app.js` — entrada de navegación, título, estado y delegación de acciones.
- Modify `public/js/enterprise-ui.js` — sin cambios funcionales; el botón `order-next` existente se conserva para órdenes sin `planId`.
- Create `tests/planner.test.mjs`, `tests/planner-sync.test.mjs`; modify `tests/scheduled.test.mjs`; add a test to `e2e/app.e2e.mjs`.
- Modify `CHANGELOG.md`, `README.md` (novedad).

---

### Task 1: Campos del plan y la visita

**Files:**
- Modify: `public/js/operations.js` (`operationFields.workOrders`, `newOperation`, `normalizeOperation`)
- Test: `tests/planner.test.mjs`

**Interfaces:**
- Consumes: `newOperation`, `normalizeOperation` existentes.
- Produces: `workOrders` con campos adicionales (todos cadenas): `planId`, `anchorDate`, `planState`, `anchorHistory` (JSON), `manualEdit` (`''|'1'`), `closedReason`, `reportTemplate` (clave de `templates`).

- [ ] **Step 1: Write failing tests** in `tests/planner.test.mjs`: (a) `newOperation('workOrders','c1')` trae todos los campos nuevos en `''`; (b) `normalizeOperation` acepta un plan con `type:'Plan de mantenimiento'`, `anchorDate:'2026-01-15'`, `planState:'Activo'`, `intervalDays:'90'`; (c) rechaza `anchorDate:'15/01/2026'`, `planState:'Otro'`, `manualEdit:'2'`, `planId:'a b'`, `reportTemplate:'no-existe'`; (d) rechaza un plan con `anchorDate` vacío y `dueDate` vacío cuando `planState==='Activo'` e `intervalDays` informado («Define la fecha ancla del plan.»); (e) acepta `anchorHistory` de 15000 caracteres.
- [ ] **Step 2: Run** `node --test tests/planner.test.mjs` — Expected: FAIL (campos desconocidos).
- [ ] **Step 3: Implement** en `operations.js`: añadir los 7 campos a `operationFields.workOrders`; en `newOperation` fijar `planState:'Activo'` solo si `type==='Plan de mantenimiento'`; en `normalizeOperation` validar `anchorDate` (`^\d{4}-\d{2}-\d{2}$`), `planState ∈ {'', 'Activo','Pausado','Cerrado'}`, `manualEdit ∈ {'','1'}`, `planId` con el regex de ID existente, `reportTemplate` ∈ `Object.keys(templates)` (importar de `domain.js`) o vacío; incluir `anchorHistory` en la lista de campos de 20000 caracteres. `catalogs.js` hereda `operationFields`, no requiere cambios.
- [ ] **Step 4: Run** `npm test` — Expected: PASS (136 previas + nuevas).
- [ ] **Step 5: Commit** `feat(planner): campos de plan y visita en órdenes de trabajo`.

### Task 2: Generación de ocurrencias

**Files:**
- Create: `public/js/planner.js`
- Test: `tests/planner.test.mjs`

**Interfaces:**
- Produces (todas exportadas, puras):
  - `PLANNER_HORIZON_DAYS = 90`
  - `addDays(iso: string, days: number): string`
  - `visitId(planId: string, iso: string): string`
  - `planAnchor(plan): string` → `plan.anchorDate || plan.dueDate`
  - `isPlanActive(plan, equipmentIds: Set<string>): boolean` → `planState` vacío o `Activo`, `status !== 'Cancelada'`, `equipmentIds.has(plan.equipmentId)`, `intervalDays` entero ≥ 1 y ancla válida.
  - `newVisit(plan, iso: string): workOrder` → registro nuevo vía `newOperation('workOrders', plan.companyId)` con `id=visitId(...)`, `type:'Orden de trabajo'`, `status:'Planificada'`, `planId`, `dueDate:iso`, y copia de `name`, `customerId`, `siteId`, `equipmentId`, `owner`, `ownerId`, `priority`, `scope`, `materials`, `reportTemplate`.
  - `ensureOccurrences(plan, visits, today, equipmentIds, horizon = PLANNER_HORIZON_DAYS): workOrder[]` → visitas a crear.

- [ ] **Step 1: Write failing tests**: ancla `2026-01-01`, `intervalDays:'30'`, hoy `2026-02-15`, horizonte 90 → fechas `2026-03-02`, `2026-04-01`, `2026-05-01`, `2026-05-31` con ID `visit-<plan>-20260302`…; la misma llamada con esas visitas ya existentes devuelve `[]` (idempotencia, también si una está `Cancelada` o `Completada`); ancla de 2020 no devuelve fechas anteriores a `today`; plan `Pausado`, `Cerrado`, equipo ausente de `equipmentIds`, `intervalDays` `''`/`'0'`/`'1.5'` → `[]`; plan legacy con `dueDate:'2026-02-20'` y sin `anchorDate` usa esa ancla; `addDays('2026-03-01',-1)==='2026-02-28'` y cruza fin de año.
- [ ] **Step 2: Run** `node --test tests/planner.test.mjs` — Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** `planner.js`. `addDays` opera con `new Date(iso+'T12:00:00')` y `localDate` (misma técnica que `operations.js`). Para ancla pasada, saltar a la primera ocurrencia ≥ `today` con aritmética de enteros (no iterar día a día).
- [ ] **Step 4: Run** tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): generación idempotente de visitas`.

### Task 3: Regeneración y cierre (mantener o correr)

**Files:**
- Modify: `public/js/planner.js`
- Test: `tests/planner.test.mjs`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `regeneratePlan(plan, visits, today, equipmentIds): {cancel: workOrder[], create: workOrder[]}` → cancela (copias con `status:'Cancelada'`, `closedReason:'calendario corrido'`) las visitas **futuras** (`dueDate >= today`) del plan en `Planificada` y sin `manualEdit`, y devuelve las visitas a crear con la ancla actual del plan. No toca `En curso`, `Completada` ni las de `manualEdit==='1'`.
  - `closeVisit(plan, visits, visit, doneDate, mode: 'keep'|'shift', today, actor: string, equipmentIds): {plan, visit, cancel, create}` → `visit` en `Completada` (con `notes` que registran `doneDate`); `keep` solo repone el horizonte con `ensureOccurrences`; `shift` pone `plan.anchorDate = doneDate`, agrega a `plan.anchorHistory` (JSON; lista de `{from,to,by,at,visitId}`, máximo 50) y usa `regeneratePlan`. Lanza `Error('Modo de cierre inválido.')` con otro `mode`.
  - `visitsToClose(visits, reports): workOrder[]` → visitas `En curso` cuyo `reportId` corresponde a un informe con `status==='Emitido'`.
  - `isLate(visit, report): boolean` → `report.serviceDate > visit.dueDate`.

- [ ] **Step 1: Write failing tests**: `keep` deja `anchorDate` igual y la siguiente fecha sigue la ancla original; `shift` con visita programada `2026-03-01` y realizada `2026-03-10`, intervalo 30 → ancla `2026-03-10`, las `Planificada` posteriores sin `manualEdit` quedan en `cancel` con `closedReason`, `create` trae `2026-04-09`, `2026-05-09`, …; una visita futura con `manualEdit:'1'` y otra `En curso` no se cancelan; `shift` no crea fechas `< today`; `anchorHistory` acumula `{from:'2026-03-01', to:'2026-03-10'}` y se limita a 50; `mode:'x'` lanza el error; `visitsToClose` solo devuelve visitas con informe emitido; `isLate` en el borde (misma fecha → false).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** reutilizando `ensureOccurrences`; `shift` evalúa el horizonte desde `max(today, doneDate)`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): cierre de visita con mantener o correr calendario`.

### Task 4: Lista por urgencia

**Files:**
- Modify: `public/js/planner.js`
- Test: `tests/planner.test.mjs`

**Interfaces:**
- Produces: `urgencyBuckets(visits, today, filters?: {ownerId?, customerId?, equipmentId?}): {overdue, today, week, next30}` — arreglos de visitas abiertas (`Planificada`/`En curso`), `overdue`: `dueDate < today`; `today`: igual; `week`: de mañana a +7; `next30`: de +8 a +30; fuera de rango se omite; orden por `dueDate` y luego prioridad (`Crítica`>`Alta`>`Media`>`Baja`).

- [ ] **Step 1: Write failing tests** de bordes (hoy, +7, +8, +30, +31), exclusión de `Completada`/`Cancelada`, filtros, orden por prioridad con la misma fecha, visita `En curso` vencida en `overdue`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `urgencyBuckets` en `planner.js`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): agrupación por urgencia`.

### Task 5: Vista Planner (lista y filtros)

**Files:**
- Create: `public/js/planner-ui.js`
- Modify: `public/js/app.js` (`state`, `titles`, `navItem`, enrutado de vista, `handleAction`, `reload` si aplica)
- Test: `e2e/app.e2e.mjs`

**Interfaces:**
- Consumes: `urgencyBuckets`, `ensureOccurrences`, `isPlanActive`, `state.workOrders`, `state.equipment`, `state.people`.
- Produces: `plannerView(state): string` (HTML), `handlePlannerAction(a, button, ctx): Promise<boolean>`, `ensurePlannerVisits(ctx): Promise<number>` (persiste las visitas faltantes; no hace nada si el rol es técnico u otra cuenta sin permiso; devuelve cuántas creó).

- [ ] **Step 1: Write failing e2e test** («el Planner lista las visitas generadas de un plan por urgencia»): crea empresa, cliente, instalación, equipo y un plan (`anchorDate` hace 20 días, 30 días) por la API local de IndexedDB; abre `Planner`; espera secciones «Vencidos», «Hoy», «Esta semana», «Próximos 30 días»; verifica la visita del plan en la sección correcta y `page.errors` vacío. Usar `createCompany` de `e2e/helpers.mjs`.
- [ ] **Step 2: Run** `npm run e2e` — Expected: FAIL (sin vista).
- [ ] **Step 3: Implement** `plannerView` siguiendo el patrón de lista de `operationsView` (clases `panel`, `catalog-card`, `pill`); filtros técnico/cliente/equipo en `state.opsFilter`; marca «Sin técnico»; aviso para planes pausados. Añadir `navItem('planner','Planner','clock')` antes de «Órdenes y mantenimiento» y `planner:['Qué toca esta semana','Planner de mantenimiento']` en `titles`. Llamar `ensurePlannerVisits` al abrir la vista, tras sincronizar, y recargar.
- [ ] **Step 4: Run** `npm run e2e` y `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): vista de planner por urgencia`.

### Task 6: Formulario de plan y aplicación a varios equipos

**Files:**
- Modify: `public/js/planner-ui.js`, `public/js/app.js` (botón y acción)
- Test: `tests/planner.test.mjs`, `e2e/app.e2e.mjs`

**Interfaces:**
- Produces: `plansFromForm(form: {name, equipmentIds: string[], anchorDate, intervalDays, ownerId, owner, scope, reportTemplate}, equipment: Equipment[], companyId): workOrder[]` en `planner.js` (un plan por equipo; copia `customerId` y `siteId` del equipo; lanza `Error('Selecciona al menos un equipo.')`/`Error('Define fecha ancla y periodicidad.')`); `planDialog(ctx)` y acción `planner-plan-save` en `planner-ui.js`.

- [ ] **Step 1: Write failing tests**: `plansFromForm` con 3 equipos devuelve 3 planes con IDs distintos, `type:'Plan de mantenimiento'`, `planState:'Activo'`; sin equipos o sin ancla lanza el error; equipo de otra empresa lanza `Error('El equipo pertenece a otra empresa.')`. E2E: crear plan para dos equipos desde el diálogo y ver ambas visitas en la lista.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `plansFromForm` (reutiliza `normalizeOperation` para validar) y el diálogo con etiquetas visibles, validación al salir del campo y botón «Crear plan». Al editar `anchorDate` o `intervalDays` de un plan existente, llamar `regeneratePlan` y persistir `cancel` y `create`. Acciones de plan: «Pausar plan», «Reanudar plan», «Cerrar plan» (cambian `planState`).
- [ ] **Step 4: Run** `npm test` y `npm run e2e` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): crear y editar planes`.

### Task 7: Iniciar visita y cierre con diálogo

**Files:**
- Modify: `public/js/planner-ui.js`, `public/js/app.js` (exponer `createReport` en el contexto si no está)
- Test: `tests/planner.test.mjs`, `e2e/app.e2e.mjs`

**Interfaces:**
- Consumes: `createReport(key, record, equipmentId)` de `app.js` (crea el informe prellenado vía `selectEquipment`), `visitsToClose`, `isLate`, `closeVisit`.
- Produces: acción `planner-start` (marca `En curso`, guarda `reportId` y abre el editor; si el `reportId` existente apunta a un informe borrado o inexistente, crea uno nuevo); `closePendingVisits(ctx): Promise<number>` (cierra sin preguntar las visitas a tiempo; para las atrasadas abre el diálogo «Mantener calendario» (por defecto) / «Correr calendario desde esta visita» y persiste `plan`, `visit`, `cancel` y `create` de `closeVisit`; ignora el cierre si el usuario no es admin/supervisor).
- `reportTemplate` vacío usa la plantilla `general`.

- [ ] **Step 1: Write failing tests** (unitarias sobre una función `startVisit(visit, reports, today)` pura que devuelve `{reportKey, visit}`): usa `reportTemplate` o `general`; informe existente no borrado → no crea otro; informe borrado → crea nuevo. E2E («cerrar una visita atrasada corriendo el calendario»): iniciar visita, emitir el informe por IndexedDB con `serviceDate` posterior a la programada, abrir Planner, elegir «Correr calendario desde esta visita» y comprobar la visita completada, las futuras con fechas nuevas y la cancelada con motivo.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `startVisit` en `planner.js` y las acciones en `planner-ui.js`. El diálogo sigue la guía de superficies: enfoque inicial en la opción por defecto y cierre con Escape sin cambios.
- [ ] **Step 4: Run** `npm test` y `npm run e2e` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(planner): iniciar visita y cierre con corrimiento de calendario`.

### Task 8: Sincronización, permisos y resumen diario

**Files:**
- Test: `tests/planner-sync.test.mjs` (usa el patrón de `tests/enterprise.test.mjs`), `tests/scheduled.test.mjs`
- Modify (solo si una prueba falla): `worker/enterprise.js`

**Interfaces:**
- Consumes: `/api/sync/push` con `kind:'workOrders'`, helpers `setup`/`company`/`person` copiados del patrón de `enterprise.test.mjs`.

- [ ] **Step 1: Write failing/pinning tests**: (a) un supervisor sube un plan y 3 visitas por `push` → 200 y quedan en `/api/sync/pull`; (b) un técnico que sube una visita con `ownerId` de otro → 403; (c) dos dispositivos suben la **misma** visita (mismo ID, `baseVersion:0`) → el segundo recibe 409 sin duplicar filas; (d) una visita con `reportId` de otra empresa → 400; (e) `scheduled.test.mjs`: una visita `Planificada` con `dueDate` de ayer aparece en el resumen como `VENCIDA`, y un plan nuevo (sin `dueDate`) no aparece.
- [ ] **Step 2: Run** `node --test tests/planner-sync.test.mjs tests/scheduled.test.mjs` — Expected: pasan (las reglas ya existen); si alguna falla, corregir `worker/enterprise.js` o `worker/scheduled.js` de forma mínima.
- [ ] **Step 3: Commit** `test(planner): sincronización, permisos y resumen diario`.

### Task 9: Documentación y verificación final

**Files:**
- Modify: `CHANGELOG.md`, `README.md`, `docs/USO_V3.md`

- [ ] **Step 1:** Añadir a `CHANGELOG.md` y `README.md` una entrada «Planner de mantenimiento» (qué hace, calendario fijo, correr calendario, que `Órdenes y mantenimiento` conserva el botón «Próxima intervención» para órdenes sin plan) y una sección breve en `docs/USO_V3.md`. No cambiar `version` en `package.json` sin confirmación del usuario.
- [ ] **Step 2: Run** `npm run build && npm run ci && npm run e2e` — Expected: todo en verde; `public/sw.js` generado incluye `/js/planner.js` y `/js/planner-ui.js`.
- [ ] **Step 3: Commit** `docs(planner): documentar el planner de mantenimiento`.

---

## Self-Review

- **Cobertura de la spec:** modelo de datos (T1), ocurrencias idempotentes y horizonte (T2), mantener/correr, historial de anclas, respeto de `manualEdit`/`En curso` (T3), lista por urgencia (T4, T5), plan para varios equipos y regeneración al editar (T6), iniciar visita y diálogo (T7), sincronización/permisos/concurrencia y resumen diario (T8), documentación (T9).
- **Cambios respecto a la spec, deliberados:** (1) el cierre ocurre cuando un administrador o supervisor abre el Planner y encuentra informes ya emitidos (el aprobador puede emitir en otro dispositivo), no en el instante de emitir; las visitas a tiempo se cierran solas y las atrasadas piden la decisión; (2) la «auditoría del corrimiento» es el historial `anchorHistory` más el registro de guardado que el servidor ya escribe en `audit_events`, sin código nuevo de servidor; (3) la ampliación del resumen diario no requiere código: `worker/scheduled.js` ya lista órdenes `Planificada`/`En curso` vencidas o de la semana, y T8 lo fija con una prueba.
- **Consistencia de tipos:** `closeVisit` devuelve `{plan, visit, cancel, create}` y T7 persiste exactamente esos cuatro; `ensureOccurrences`, `regeneratePlan` y `closeVisit` comparten `equipmentIds: Set<string>`.
