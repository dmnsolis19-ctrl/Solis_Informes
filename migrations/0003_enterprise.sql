-- Preserve all document versions and add independent operational records.
DROP TRIGGER entities_insert;
DROP TRIGGER entities_update;
CREATE TABLE entities_v4 (workspace_id TEXT NOT NULL REFERENCES workspaces(id), kind TEXT NOT NULL CHECK(kind IN ('reports','companies','customers','sites','equipment','reportTemplates','tasks','workOrders','manuals','alertRules')), id TEXT NOT NULL, version INTEGER NOT NULL, mutation_id TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, folio TEXT, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(workspace_id,kind,id));
INSERT INTO entities_v4 SELECT * FROM entities;
DROP TABLE entities;
ALTER TABLE entities_v4 RENAME TO entities;
CREATE UNIQUE INDEX unique_document_revision ON entities(workspace_id,folio,revision) WHERE kind='reports' AND deleted=0;
CREATE INDEX catalog_company ON entities(workspace_id,kind,json_extract(data,'$.companyId')) WHERE deleted=0;
CREATE UNIQUE INDEX unique_equipment_tag ON entities(workspace_id,json_extract(data,'$.companyId'),lower(json_extract(data,'$.tag'))) WHERE kind='equipment' AND deleted=0;
CREATE TRIGGER entities_insert AFTER INSERT ON entities BEGIN
 INSERT INTO change_log(workspace_id,kind,entity_id,version) VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version);
 INSERT INTO entity_history VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version,NEW.data,NEW.deleted,NEW.updated_at,NEW.updated_by);
END;
CREATE TRIGGER entities_update AFTER UPDATE ON entities BEGIN
 INSERT INTO change_log(workspace_id,kind,entity_id,version) VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version);
 INSERT INTO entity_history VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version,NEW.data,NEW.deleted,NEW.updated_at,NEW.updated_by);
END;

ALTER TABLE users ADD COLUMN company_ids TEXT NOT NULL DEFAULT '["*"]';
ALTER TABLE users ADD COLUMN customer_id TEXT NOT NULL DEFAULT '';
CREATE TABLE audit_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, company_id TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, actor_id TEXT NOT NULL, actor_email TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL,request_id TEXT NOT NULL DEFAULT '');
CREATE INDEX audit_workspace ON audit_events(workspace_id,company_id,seq);
CREATE TABLE portal_feedback (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,company_id TEXT NOT NULL,customer_id TEXT NOT NULL,report_id TEXT NOT NULL,user_id TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE file_access (workspace_id TEXT NOT NULL,hash TEXT NOT NULL,company_id TEXT NOT NULL,PRIMARY KEY(workspace_id,hash,company_id));

CREATE UNIQUE INDEX audit_request ON audit_events(workspace_id,request_id) WHERE request_id!='';
