# Actualizar de 3.13.0 a SOLIS Field Pro 3.14.0

Esta entrega personaliza la Vista general según el rol. No hay migraciones de base de datos, no cambia la sincronización ni IndexedDB, y conserva tu `wrangler.jsonc` y los identificadores de D1/R2.

1. Descarga un respaldo de cada dispositivo con cambios pendientes.
2. Actualiza el repositorio conectado a Cloudflare con esta versión (fusiona el pull request o descarga el ZIP de `main`). Conserva tu `wrangler.jsonc` actual.
3. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs`. Usa Node.js 24.
4. Abre la aplicación con conexión, cierra y vuelve a abrir. Comprueba `Field Pro · v3.14.0`.

## Qué cambia

- Administrador / supervisor: «Qué requiere atención» (vencidas, hoy, sin técnico).
- Técnico: «Mis visitas de hoy» con «Iniciar visita».
