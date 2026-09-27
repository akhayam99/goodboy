export const m206ProjectRelocations = `
CREATE TABLE project_relocations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_root TEXT NOT NULL,
  to_root TEXT NOT NULL,
  moved_at INTEGER NOT NULL,
  undone_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_relocations_project_id ON project_relocations(project_id);
CREATE INDEX idx_project_relocations_moved_at ON project_relocations(moved_at);
`;
