# Planner · reprogramar y cancelar visitas — diseño

Fecha: 2026-11-12 · Estado: decidido por el responsable del producto («continua mejorando la plataforma»). Versión objetivo: **3.11.0**. **Sin migraciones ni campos de datos nuevos** (se usan `dueDate`, `status`, `closedReason`, `manualEdit` y `notes` existentes).

## Objetivo

Quien planifica necesita resolver imprevistos sin salir del Planner: mover una visita a otra fecha (cliente no disponible, repuesto que no llegó) o cancelarla (equipo fuera de servicio este mes). Hoy solo existe «Reasignar»; para lo demás hay que abrir el editor genérico de «Órdenes y mantenimiento» y editar campos a mano.

## Reglas comunes (igual que «Reasignar»)

- Botones **«Reprogramar»** y **«Cancelar visita»** en la tarjeta de toda visita `Planificada` (vistas Lista, Calendario y Carga). Solo administrador/supervisor y modo local (`canGenerateVisits` con el rol guardado); los técnicos no los ven. El control se aplica también en el manejador de la acción (no solo ocultando botones). El Worker ya rechaza que un técnico escriba visitas de otro.
- Solo visitas `Planificada` (una visita `En curso` ya tiene informe; `Completada`/`Cancelada` no se tocan).
- **Guardado con el control de conflictos de siempre:** se guarda el objeto del estado con su `_sync` (nunca releer `_sync` del almacén), `LOCAL_CHANGED`/conflicto/borrada/ya no `Planificada` → mensaje «Esta visita cambió en otro dispositivo. Actualiza la pantalla e inténtalo de nuevo.» sin escribir. Guarda de doble clic (bandera de módulo y botón deshabilitado), Escape cierra sin cambios, y la tecla Enter en el formulario guarda (mapa de formularios de `app.js`, como «Reasignar»; sin recarga de página).
- Ambas acciones dejan `manualEdit='1'`: la visita queda protegida de «Correr calendario» y de las ediciones del plan.

## Reprogramar

- Diálogo «Reprogramar visita»: muestra el nombre, el equipo y la fecha actual; campo **«Nueva fecha»** (`input type=date`, etiqueta visible, valor inicial = fecha actual); aviso informativo bajo el campo cuando la fecha elegida ya tiene visitas **abiertas del mismo responsable** («Ese día el técnico ya tiene 2 visitas.»; sin aviso si no hay responsable); botones «Reprogramar» y «Cancelar».
- Validación al salir del campo y al guardar, en español y sin culpar: fecha inválida o vacía → «Elige una fecha válida.»; igual a la actual → «Sin cambios: elige una fecha distinta.»; fuera de `[hoy − 365 días, hoy + 730 días]` → «Elige una fecha entre <desde> y <hasta>.».
- Efecto: `dueDate = nueva fecha`, `manualEdit='1'`; el `id` **no cambia** (el id determinista no se recalcula; el generador sigue considerándola existente, así que no se vuelve a crear una visita en la fecha original). Función pura `rescheduleVisit(visit, date, today) → visit | null` (null si no es `Planificada` o la fecha es igual; lanza `Error` en español si la fecha es inválida o está fuera de rango). Toast «Visita reprogramada al <fecha>.».
- En Calendario, la visita pasa al nuevo día (y el día seleccionado se conserva); en Carga cambia de semana si corresponde.

## Cancelar visita

- Diálogo «Cancelar visita» con el nombre, el equipo y la fecha, un campo opcional **«Motivo»** (texto de hasta 200 caracteres, `maxlength` y validación al guardar) y el texto «La visita no se volverá a generar. Quedará registrada como cancelada.»; botones «Cancelar visita» (acción destructiva con nombre explícito) y «Volver».
- Efecto: `status='Cancelada'`, `closedReason='visita cancelada'`, `manualEdit='1'`, y `notes` recibe una línea añadida `Visita cancelada el AAAA-MM-DD: <motivo>` (sin motivo: `Visita cancelada el AAAA-MM-DD.`), respetando el límite de `notes`. Función pura `cancelVisit(visit, reason, today) → visit | null` (null si no es `Planificada`).
- No se regenera: el generador cuenta cualquier visita existente (también `Cancelada`) y solo revive las canceladas por `calendario corrido`; `shouldWriteCancel` no toca otras `Cancelada`. Pruebas que lo fijan.
- Las canceladas dejan de verse en las vistas del Planner y **no cuentan como medibles en los indicadores** (hay que decirlo en `docs/USO_V3.md`: cancelar o reprogramar cambia la base del cálculo). Se pueden restaurar desde «Órdenes y mantenimiento» → «Abrir / editar» → Estado = Planificada (documentarlo).

## Accesibilidad y móvil

Botones con verbo primero y objetivo táctil ≥ 40 px en móvil; diálogos con foco inicial en el primer campo, `aria-describedby` para los errores, Escape; sin animaciones nuevas; sin desbordamiento horizontal a 375 px; tema oscuro.

## Pruebas

- Unitarias: `rescheduleVisit` (cambia fecha y `manualEdit`; misma fecha → null; Completada/En curso/Cancelada → null; fechas inválidas y límites del rango, incluido el borde exacto; no muta), `cancelVisit` (estado, motivo, nota añadida sin pisar las anteriores, límite de longitud, sin motivo; no muta), regeneración: después de reprogramar o cancelar, `ensureOccurrences`/`regeneratePlan`/`closeVisit shift` no crean duplicados ni cancelan ni reviven esas visitas; conteo de visitas del mismo responsable ese día (función pura) y límites de fecha calculados con aritmética UTC entera.
- Navegador: reprogramar desde la lista y desde el calendario (la visita cambia de día, `manualEdit='1'`, mismo `id`, Enter guarda, fecha inválida y misma fecha muestran el mensaje); aviso de día ocupado; cancelar con motivo (desaparece, estado, `closedReason`, `notes`, y al recargar el Planner no reaparece); el técnico no ve los botones; conflicto entre dispositivos (la visita cambia en otro lado antes de guardar → mensaje y sin escritura); sin desbordamiento a 375 px; fechas relativas a hoy y también con fecha simulada (2026-12-03 y 2027-01-02).

## Fuera de alcance

Arrastrar para reprogramar, reprogramación en bloque, deshacer con un toque, restaurar canceladas desde el Planner, motivos predefinidos, avisos al técnico asignado.
