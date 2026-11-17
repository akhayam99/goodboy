export const m244SessionDockGrids = `
CREATE TABLE session_dock_grids (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  grid TEXT NOT NULL CHECK (json_valid(grid)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
