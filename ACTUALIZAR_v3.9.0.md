# Actualizar de 3.8.0 a SOLIS Field Pro 3.9.0

Esta entrega agrega la **vista de carga por técnico** y **Reasignar** al Planner, y cierra dos pendientes de 3.8.0 (plan en solo lectura para técnicos y rol guardado al cerrar sesión). No hay migraciones de base de datos, no cambia el protocolo de sincronización ni el esquema de IndexedDB, y conserva tu `wrangler.jsonc` y los identificadores de D1/R2.

1. Guarda los formularios y descarga un respaldo de cada dispositivo con cambios pendientes.
2. Actualiza el repositorio conectado a Cloudflare con esta versión (fusiona el pull request o copia el contenido). Conserva tu `wrangler.jsonc` actual.
3. Compilación: `node scripts/ci.mjs`. Despliegue: `node scripts/deploy.mjs` (ejecuta primero el build, para que los equipos instalados reciban los archivos nuevos). Usa Node.js 24.
4. Cuando termine el despliegue, abre la aplicación con conexión, cierra y vuelve a abrir para activar la actualización. Comprueba `Field Pro · v3.9.0`. Actualiza todas las pestañas y dispositivos.

## Carga por técnico y reasignar

Planner → selector **Lista | Calendario | Carga**. «Carga» muestra una tabla de responsables por «Vencidas» y las próximas 6 semanas con el número de visitas abiertas; al pulsar una celda se listan sus visitas. Los administradores y supervisores ven «Reasignar» en las visitas planificadas; los técnicos no. Los técnicos abren los planes en solo lectura.

Detalle en `docs/USO_V3.md` (sección «Planner de mantenimiento», «Carga por técnico» y «Reasignar una visita»).
