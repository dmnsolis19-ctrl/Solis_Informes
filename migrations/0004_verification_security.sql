-- 0004 · Verificación pública de documentos, verificación en dos pasos, errores del cliente y avisos.
-- Solo agrega estructuras: no modifica ni elimina datos existentes.

-- Registro público mínimo de documentos emitidos (sin contenido del informe).
CREATE TABLE document_integrity (
  code TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  folio TEXT NOT NULL,
  revision INTEGER NOT NULL,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE INDEX document_integrity_report ON document_integrity(workspace_id, report_id);

-- Verificación en dos pasos (TOTP, RFC 6238). El secreto se guarda cifrado.
ALTER TABLE users ADD COLUMN totp_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_last_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_recovery TEXT NOT NULL DEFAULT '[]';

-- Errores de la aplicación en los dispositivos, para diagnosticar fallas en terreno.
CREATE TABLE client_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  stack TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX client_errors_workspace ON client_errors(workspace_id, id);

-- Un resumen de avisos por usuario y día (evita duplicados si el proceso se repite).
CREATE TABLE notification_log (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day, kind)
);
