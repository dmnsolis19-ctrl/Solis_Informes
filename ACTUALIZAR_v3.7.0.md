# Actualizar de 3.6.0 a SOLIS Field Pro 3.7.0

Esta entrega agrega el **Planner de mantenimiento**. No hay migraciones de base de datos (se mantiene hasta la 0004), no cambia el protocolo de sincronización ni el esquema de IndexedDB, y conserva tu `wrangler.jsonc` y los identificadores de D1/R2.

1. Guarda los formularios y descarga un respaldo de cada dispositivo con cambios pendientes.
2. Actualiza el repositorio conectado a Cloudflare con esta versión (fusiona el pull request o copia el contenido). Conserva tu `wrangler.jsonc` actual.
3. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs` (ejecuta primero el build, para que los equipos instalados reciban los archivos nuevos). Usa Node.js 24.
4. Cuando termine el despliegue, abre la aplicación con conexión, cierra y vuelve a abrir para activar la actualización. Comprueba `Field Pro · v3.7.0`. Actualiza todas las pestañas y dispositivos.
5. Planes anteriores: los planes de mantenimiento y órdenes que ya tenías siguen funcionando como antes en «Órdenes y mantenimiento». Los planes nuevos se crean y editan desde **Planner** (el botón «Programar siguiente» no se ofrece para ellos).

## Planner de mantenimiento

Planner (menú, antes de «Órdenes y mantenimiento») → **Crear plan**: elige equipos, fecha ancla y periodicidad en días. Las visitas se generan 90 días por adelantado; «Iniciar visita» crea el informe de servicio prellenado y, al emitirse, la visita se cierra. Si se hizo con retraso, puedes mantener el calendario o correrlo desde la fecha real. Los administradores y supervisores generan y cierran visitas; los técnicos inician las suyas o las que no tienen responsable.

Detalle, ejemplo de «Correr calendario» y limitaciones de la fase 1 en `docs/USO_V3.md` (sección «Planner de mantenimiento»).
