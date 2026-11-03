# Revisión 3.5.1

Base: repositorio `Solis_Informes` 3.5.0 (95 pruebas superadas antes de modificar).

## Cambios y comprobación

| Área | Cambio | Comprobación |
|---|---|---|
| Despliegue | Build antes de `deploy`; capturas fuera del precaché | `node scripts/ci.mjs` |
| Servidor | Límite de intentos atómico | `tests/hardening.test.mjs` (10 llamadas simultáneas, límite 4: pasan exactamente 4) |
| Servidor | HSTS y Permissions-Policy | `tests/hardening.test.mjs` y comprobación en Chromium |
| Servidor | `file_access` indexado con respaldo por referencia | `tests/hardening.test.mjs`; aislamiento existente en `tests/enterprise.test.mjs` |
| Servidor | Fotografías en paralelo, orden conservado | `tests/hardening.test.mjs` (12 fotos) |
| Servidor | Retirada de `/api/users` | `tests/hardening.test.mjs` (404; `/api/team` sigue activo) |
| PWA | Íconos, manifest, metas iOS | Carga en Chromium: manifest e íconos responden 200, el service worker se activa, sin errores de consola |
| Privacidad | Empresa inicial neutra | Recorrido en Chromium: al elegir plantilla se pide completar la razón social |

## Límites de la validación

- No se desplegó en Cloudflare: D1, R2, Workers AI, Browser Run y Resend siguen pendientes de comprobación en tu cuenta.
- No se probó la instalación en iPhone ni en Android; los íconos *maskable* se revisaron como imagen.
- El formato de código (Prettier) se configuró, pero no se reformó el código existente para no alterar un historial verificado.
