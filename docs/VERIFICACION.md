# Verificación de la entrega 2.0.0

Fecha: 23 de octubre de 2026.

## Pruebas automatizadas

24 pruebas superadas mediante `node --test` y comprobación de sintaxis de todos los módulos.

Cobertura:

- Nueve plantillas; lecturas inicialmente vacías e independientes.
- Resultado de inspección: No aplica no equivale a Conforme.
- Campos necesarios para emitir un documento.
- Revisión que conserva el original y retira firmas de la copia.
- Cálculos de propuestas y fecha local.
- Normalización de registros de la versión anterior.
- Confirmaciones de sincronización que no borran cambios posteriores.
- Escape de contenido e impedimento de imágenes externas en documentos.
- Preparación de interfaz offline y recuperación de navegación sin red mediante un entorno simulado de service worker.
- Exclusión de API privada y enlaces compartidos de la caché de la PWA.
- Actualización que conserva cachés ajenas.
- Instalación protegida y sesiones HttpOnly/Secure en HTTPS.
- Autenticación y validación de origen.
- Sincronización idempotente, lectura incremental y rechazo de versiones obsoletas.
- Dos escrituras simultáneas: una confirmada y otra informada como conflicto.
- Control de folio y revisión duplicados.
- Bloqueo de modificación y eliminación de documentos emitidos.
- Eliminación recuperable y restauración mediante tombstones.
- Evidencias privadas en R2 y referencias sin base64 en D1.
- Aislamiento de datos entre espacios de trabajo.
- Enlaces exclusivos para documentos emitidos, acceso público con token y revocación.
- Contrato del asistente IA y requisito de configuración de correo.
- Contrato de PDF A4 y numeración de páginas.

El adaptador de pruebas utiliza SQLite real con el esquema SQL incluido. La interfaz R2 se reproduce en memoria. Workers AI y Browser Run se prueban con dobles de servicio. No se enviaron correos, no se consumió IA y no se generó un PDF real en la cuenta Cloudflare del usuario.

## Revisión en navegador

Se verificaron:

- Carga del panel de inicio.
- Creación de un informe general con folio nuevo.
- Escritura y conservación de campos al cambiar de sección.
- Autoguardado y presencia del documento al abrir otra vista de la aplicación.
- Vista previa del documento con logo, datos corporativos, encabezado y secciones.
- Composición del panel y formulario en contenedores de 390 y 768 píxeles.
- Ausencia de desbordamiento horizontal en las vistas examinadas; el área útil fue de 375 y 753 píxeles tras descontar las barras del navegador.

La comprobación responsive se realizó en Chrome con contenedores de esos tamaños, no en dispositivos físicos. La previsualización interna usa HTTP; la instalación PWA y el comportamiento offline completo deben verificarse en la dirección HTTPS publicada o en localhost. La prueba del service worker automatizada simula su ciclo de instalación, activación y solicitudes.

## Pendiente en tu nube

Una vez publicados el código, D1 y R2:

1. Crear el administrador con tu SETUP_TOKEN.
2. Confirmar sincronización real computador ↔ teléfono, incluyendo un conflicto intencional.
3. Abrir una vez la aplicación por HTTPS, desconectar internet y comprobar reapertura, fotografías y guardado.
4. Generar un PDF real con textos largos y varias fotografías; revisar sus saltos y numeración.
5. Probar el menú nativo de compartir en Android/iOS, WhatsApp y el cliente de correo elegido.
6. Si habilitas Resend, verificar un envío real desde un remitente autorizado.
7. Si habilitas Workers AI, revisar la calidad y fidelidad de la redacción con tus casos reales.
8. Publicar un segundo commit y comprobar actualización automática con un borrador activo.

Estos pasos requieren tus recursos y configuración de Cloudflare. La entrega no afirma que ya estén desplegados ni verificados en tu cuenta.
