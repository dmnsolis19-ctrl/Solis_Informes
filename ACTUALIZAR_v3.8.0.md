# Actualizar de 3.7.0 a SOLIS Field Pro 3.8.0

Esta entrega agrega la **vista de calendario** del Planner y corrige el diálogo «Crear plan». No hay migraciones de base de datos, no cambia el protocolo de sincronización ni el esquema de IndexedDB, y conserva tu `wrangler.jsonc` y los identificadores de D1/R2.

1. Guarda los formularios y descarga un respaldo de cada dispositivo con cambios pendientes.
2. Actualiza el repositorio conectado a Cloudflare con esta versión (fusiona el pull request o copia el contenido). Conserva tu `wrangler.jsonc` actual.
3. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs` (ejecuta primero el build, para que los equipos instalados reciban los archivos nuevos). Usa Node.js 24.
4. Cuando termine el despliegue, abre la aplicación con conexión, cierra y vuelve a abrir para activar la actualización. Comprueba `Field Pro · v3.8.0`. Actualiza todas las pestañas y dispositivos.

## Vista de calendario

Planner → selector **Lista | Calendario** (se recuerda en cada dispositivo). El calendario muestra el mes con la semana desde el lunes, hasta 3 visitas por día y «+N más»; «Mes anterior», «Mes siguiente» y «Hoy» cambian de mes y los filtros de técnico, cliente y equipo se aplican igual. Al pulsar un día se listan todas sus visitas con sus acciones. En móvil cada día muestra un contador. Es solo otra vista de las mismas visitas: no cambia cuándo se generan o cierran.

Detalle en `docs/USO_V3.md` (sección «Planner de mantenimiento», «Vista de calendario»).
