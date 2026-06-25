export const m045StepLibrary = /* sql */ `
PRAGMA foreign_keys = OFF;

-- 1. Reusable step library (type \`Step\`). workspace_id NULL = global seed.
CREATE TABLE IF NOT EXISTS step_library (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  base_step_id TEXT,
  role TEXT NOT NULL DEFAULT 'custom',
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_default TEXT,
  model_default TEXT,
  effort_default TEXT,
  verbosity_default TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (base_step_id) REFERENCES step_library(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_step_library_workspace ON step_library(workspace_id);
CREATE INDEX IF NOT EXISTS idx_step_library_base ON step_library(base_step_id) WHERE base_step_id IS NOT NULL;

-- A workflow is a reusable preset only when is_preset = 1. A "custom" workflow
-- the user runs without ticking "save as preset" is persisted (its session
-- references it) but is_preset = 0, so it never shows in the preset picker.
-- Existing workflows predate the distinction and were all reusable, so default 1.
ALTER TABLE workflows ADD COLUMN is_preset INTEGER NOT NULL DEFAULT 1;

-- 2. Backfill the library from existing instances BEFORE rebuilding steps.
--    Every existing instance gets its own library entry, scoped to the
--    workflow's workspace. 1:1 (no dedup) keeps the migration deterministic;
--    users can later merge duplicates from the library manager.
INSERT OR IGNORE INTO step_library
  (id, workspace_id, role, name, prompt_prefix,
   provider_default, model_default, effort_default, created_at, updated_at, deleted_at)
SELECT
  'lib_' || s.id,
  w.workspace_id,
  'custom',
  s.name,
  s.prompt_prefix,
  s.provider_override,
  s.model_override,
  s.effort,
  COALESCE(w.created_at, datetime('now')),
  datetime('now'),
  s.deleted_at
FROM steps s
JOIN workflows w ON w.id = s.workflow_id;

-- 3. Rebuild steps (now the in-workflow instance, type \`Step\`) to drop
--    UNIQUE(workflow_id, ordinal) and add library_step_id / verbosity /
--    parallel_group. FK pragma is OFF so agents.step_id (-> steps) survives the
--    drop+rename by name, exactly like the m031 rebuilds.
DROP TABLE IF EXISTS steps_new;
CREATE TABLE steps_new (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  library_step_id TEXT,
  ordinal INTEGER NOT NULL,
  name TEXT NOT NULL,
  prompt_prefix TEXT NOT NULL DEFAULT '',
  provider_override TEXT,
  model_override TEXT,
  effort TEXT,
  verbosity TEXT,
  parallel_group INTEGER,
  deleted_at INTEGER,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (library_step_id) REFERENCES step_library(id) ON DELETE SET NULL
);
INSERT INTO steps_new
  (id, workflow_id, library_step_id, ordinal, name, prompt_prefix,
   provider_override, model_override, effort, verbosity, parallel_group, deleted_at)
SELECT
  s.id, s.workflow_id, 'lib_' || s.id, s.ordinal, s.name, s.prompt_prefix,
  s.provider_override, s.model_override, s.effort, NULL, NULL, s.deleted_at
FROM steps s;
DROP TABLE steps;
ALTER TABLE steps_new RENAME TO steps;
CREATE INDEX IF NOT EXISTS idx_steps_workflow_id ON steps(workflow_id);

-- 4. Seed the global library (workspace_id NULL) with the canonical roles so
--    every workspace can compose presets without authoring from scratch.
INSERT OR IGNORE INTO step_library (id, workspace_id, role, name, prompt_prefix) VALUES
  ('seed_scout', NULL, 'scout', 'Scout',
   'Explore the codebase and locate exactly where the relevant code lives. Report files, symbols and entry points. Do not modify code.'),
  ('seed_planner', NULL, 'planner', 'Plan',
   'Produce a concrete, ordered implementation plan with file paths and the specific changes per file. Do not write code.'),
  ('seed_implementer', NULL, 'implementer', 'Implement',
   'Implement the agreed plan with minimal, correct changes. Stay within scope. No speculative abstractions.'),
  ('seed_reviewer', NULL, 'reviewer', 'Review',
   'Review the current diff for correctness bugs, security issues and regressions. Report findings. Do not rewrite unrelated code.'),
  ('seed_tester', NULL, 'tester', 'Test',
   'Write or run tests that cover the change, including edge cases. Fix the code, never weaken the test.'),
  ('seed_investigator', NULL, 'investigator', 'Investigate',
   'Reproduce the issue and root-cause it before proposing any fix. Report the underlying cause.'),
  ('seed_architect', NULL, 'architect', 'Architect',
   'Design the high-level approach and call out the main trade-offs and alternatives.'),
  ('seed_explorer', NULL, 'explorer', 'Explore',
   'Broadly survey the problem space and surface the viable options with their pros and cons.'),
  ('seed_product', NULL, 'product', 'Spec',
   'Clarify the user-facing behavior and acceptance criteria. Flag open questions before any code is written.');

PRAGMA foreign_key_check;
PRAGMA foreign_keys = ON;
`
