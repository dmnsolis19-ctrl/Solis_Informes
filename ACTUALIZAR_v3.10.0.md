# Actualizar de 3.9.0 a SOLIS Field Pro 3.10.0

Esta entrega agrega la vista **Indicadores** al Planner (cumplimiento, puntualidad, atraso promedio, vencidas abiertas, tabla por técnico, evolución mensual y exportación CSV). No hay migraciones de base de datos, no cambia el protocolo de sincronización ni el esquema de IndexedDB, y conserva tu `wrangler.jsonc` y los identificadores de D1/R2.

1. Guarda los formularios y descarga un respaldo de cada dispositivo con cambios pendientes.
2. Actualiza el repositorio conectado a Cloudflare con esta versión (fusiona el pull request o copia el contenido). Conserva tu `wrangler.jsonc` actual.
3. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs` (ejecuta primero el build, para que los equipos instalados reciban los archivos nuevos). Usa Node.js 24.
4. Cuando termine el despliegue, abre la aplicación con conexión, cierra y vuelve a abrir para activar la actualización. Comprueba `Field Pro · v3.10.0`. Actualiza todas las pestañas y dispositivos.

## Indicadores de cumplimiento

Planner → selector **Lista | Calendario | Carga | Indicadores**. Elige el período (30, 90 o 180 días) y, si quieres, filtra por técnico, cliente o equipo. «Exportar CSV» descarga el detalle de las visitas medidas.

Detalle en `docs/USO_V3.md` (sección «Planner de mantenimiento», «Indicadores»).
