# Actualizar de 3.10.0 a SOLIS Field Pro 3.11.0

Esta entrega agrega las acciones **Reprogramar** y **Cancelar visita** a las tarjetas de visitas planificadas del Planner. No hay migraciones de base de datos, no cambia el protocolo de sincronización ni el esquema de IndexedDB, y conserva tu `wrangler.jsonc` y los identificadores de D1/R2.

1. Guarda los formularios y descarga un respaldo de cada dispositivo con cambios pendientes.
2. Actualiza el repositorio conectado a Cloudflare con esta versión (fusiona el pull request o copia el contenido). Conserva tu `wrangler.jsonc` actual.
3. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs` (ejecuta primero el build, para que los equipos instalados reciban los archivos nuevos). Usa Node.js 24.
4. Cuando termine el despliegue, abre la aplicación con conexión, cierra y vuelve a abrir para activar la actualización. Comprueba `Field Pro · v3.11.0`. Actualiza todas las pestañas y dispositivos.

## Reprogramar y cancelar visitas

Planner → en cada visita Planificada (Lista, Calendario y Carga) los administradores y supervisores ven **Reprogramar** (elige una nueva fecha) y **Cancelar visita** (motivo opcional). Ambas protegen la visita de «Correr calendario». Los técnicos no ven los botones.

Detalle en `docs/USO_V3.md` (sección «Planner de mantenimiento», «Reprogramar una visita» y «Cancelar una visita»).
