PRAGMA foreign_keys = ON;
CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE users (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'editor', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE entities (workspace_id TEXT NOT NULL REFERENCES workspaces(id), kind TEXT NOT NULL CHECK(kind IN ('reports','companies')), id TEXT NOT NULL, version INTEGER NOT NULL, mutation_id TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, folio TEXT, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(workspace_id,kind,id));
CREATE UNIQUE INDEX unique_document_revision ON entities(workspace_id,folio,revision) WHERE kind='reports' AND deleted=0;
CREATE TABLE change_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL, version INTEGER NOT NULL);
CREATE INDEX changes_workspace_seq ON change_log(workspace_id,seq);
CREATE TABLE entity_history (workspace_id TEXT NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, deleted INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(workspace_id,kind,entity_id,version));
CREATE TRIGGER entities_insert AFTER INSERT ON entities BEGIN
 INSERT INTO change_log(workspace_id,kind,entity_id,version) VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version);
 INSERT INTO entity_history VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version,NEW.data,NEW.deleted,NEW.updated_at,NEW.updated_by);
END;
CREATE TRIGGER entities_update AFTER UPDATE ON entities BEGIN
 INSERT INTO change_log(workspace_id,kind,entity_id,version) VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version);
 INSERT INTO entity_history VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version,NEW.data,NEW.deleted,NEW.updated_at,NEW.updated_by);
END;
CREATE TABLE shares (token_hash TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, report_id TEXT NOT NULL, object_key TEXT NOT NULL, created_by TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
CREATE INDEX shares_workspace ON shares(workspace_id);
CREATE TABLE deliveries (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, token_hash TEXT NOT NULL, recipient TEXT NOT NULL, provider_id TEXT, created_at TEXT NOT NULL);
