# Actualizar de 3.11.0 a SOLIS Field Pro 3.12.0

Esta entrega ordena la pantalla de inicio («Vista general») y el Planner. No hay migraciones de base de datos, no cambia la sincronización ni IndexedDB, y conserva tu `wrangler.jsonc` y los identificadores de D1/R2.

1. Descarga un respaldo de cada dispositivo con cambios pendientes.
2. Actualiza el repositorio conectado a Cloudflare con esta versión (fusiona el pull request o descarga el ZIP de `main`). Conserva tu `wrangler.jsonc` actual.
3. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs`. Usa Node.js 24.
4. Abre la aplicación con conexión, cierra y vuelve a abrir para activar la actualización. Comprueba `Field Pro · v3.12.0`.

## Qué cambia

- Vista general: las cifras (borradores, en revisión, emitidos, acciones vencidas) aparecen arriba, con el número grande sobre su etiqueta; los filtros quedan plegados bajo «Filtrar» (se abren solos si hay alguno activo); se quita el titular repetido.
- Planner: sin planes ya no se muestran filtros ni un segundo botón «Crear plan».
- Tablas: los encabezados ya no se parten a mitad de palabra.
