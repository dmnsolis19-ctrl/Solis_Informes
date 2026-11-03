# Revisión 3.6.0

Base: repositorio `Solis_Informes` 3.5.1 (95 pruebas automáticas al comenzar el trabajo de esta versión; 100 con 3.5.1).

## Resultado

- `node scripts/ci.mjs`: sintaxis de 76 módulos, **136 pruebas automáticas** y compilación de 42 recursos.
- `npm run e2e`: **4 pruebas de navegador** (Chromium) superadas.

## Cobertura por función

| Función | Pruebas automáticas | Comprobación en navegador |
|---|---|---|
| Plantillas nuevas | contrato de servidor, búsqueda, prefijos y códigos únicos | selección por especialidad y creación del informe |
| Gráficos y CSV | validación, submuestreo, zona horaria, escape de texto, integración de energía, formatos de fecha y números | importación desde el editor, vista previa con 2 gráficos y energía integrada de 11,5 kWh |
| Verificación pública | huella canónica, emisión, alteración, revisión posterior, código inexistente, intento de falsificación, enlace compartido | página de verificación y QR decodificado con un lector independiente |
| Tarea diaria | limpieza de enlaces, respaldo (idempotente, destino aparte, retención), resumen por correo (una vez al día, por empresa, reintento si falla) | — |
| Fotografías y dictado | validación, formato y presentación en el documento | captura con hora y ubicación simuladas; dictado con reconocimiento de voz simulado |
| Dos pasos | vectores RFC 6238 y RFC 4648, ventana, reutilización, recuperación, desactivación, límite de intentos, cifrado del secreto | activación, cierre de sesión e ingreso con código |
| Errores de dispositivos | sesión obligatoria, truncado, límite por hora, lectura solo para administrador | error provocado y visible en la lista |
| Servidor por módulos, IA | las pruebas de 3.5 se ejecutan sin cambios sobre la nueva estructura; modelo configurable y contexto acotado | — |
| Sin conexión | — | la aplicación abre sin red tras la primera visita |

## Hallazgo durante la validación

Un `sw.js` sin regenerar dejaba la aplicación sin los módulos nuevos al abrirla sin conexión. `scripts/deploy.mjs` y `scripts/ci.mjs` ejecutan el build, y la prueba de navegador de uso sin conexión lo comprueba. La integración continua también verifica que `public/sw.js` esté al día.

## Validación pendiente en tu entorno

- No se desplegó en Cloudflare: la migración 0004, R2 (respaldos), Resend (resumen diario), Workers AI con el nuevo modelo y Browser Run (PDF con QR) deben comprobarse en tu cuenta. Los correos y el modelo de IA se probaron con dobles de servicio.
- El dictado y la ubicación usan servicios del navegador; se probaron simulados. Compruébalos en un teléfono real.
- No se probó en iPhone ni en Android. El dictado por voz no está disponible en todos los navegadores.
- Los respaldos no incluyen las fotografías ni los archivos de R2.
- No hay notificaciones push: los avisos se envían por correo.
- La calidad de redacción del modelo de IA nuevo no se evaluó con informes reales.
