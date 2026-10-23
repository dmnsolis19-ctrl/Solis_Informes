-- Extend entity kinds without changing document IDs, versions or history.
DROP TRIGGER entities_insert;
DROP TRIGGER entities_update;
CREATE TABLE entities_v3 (workspace_id TEXT NOT NULL REFERENCES workspaces(id), kind TEXT NOT NULL CHECK(kind IN ('reports','companies','customers','sites','equipment','reportTemplates')), id TEXT NOT NULL, version INTEGER NOT NULL, mutation_id TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, folio TEXT, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY(workspace_id,kind,id));
INSERT INTO entities_v3 SELECT * FROM entities;
DROP TABLE entities;
ALTER TABLE entities_v3 RENAME TO entities;
CREATE UNIQUE INDEX unique_document_revision ON entities(workspace_id,folio,revision) WHERE kind='reports' AND deleted=0;
CREATE TRIGGER entities_insert AFTER INSERT ON entities BEGIN
 INSERT INTO change_log(workspace_id,kind,entity_id,version) VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version);
 INSERT INTO entity_history VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version,NEW.data,NEW.deleted,NEW.updated_at,NEW.updated_by);
END;
CREATE TRIGGER entities_update AFTER UPDATE ON entities BEGIN
 INSERT INTO change_log(workspace_id,kind,entity_id,version) VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version);
 INSERT INTO entity_history VALUES(NEW.workspace_id,NEW.kind,NEW.id,NEW.version,NEW.data,NEW.deleted,NEW.updated_at,NEW.updated_by);
END;
CREATE INDEX catalog_company ON entities(workspace_id,kind,json_extract(data,'$.companyId')) WHERE deleted=0;
CREATE UNIQUE INDEX unique_equipment_tag ON entities(workspace_id,json_extract(data,'$.companyId'),lower(json_extract(data,'$.tag'))) WHERE kind='equipment' AND deleted=0;
