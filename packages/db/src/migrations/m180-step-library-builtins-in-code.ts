export const m180StepLibraryBuiltinsInCode = `
INSERT OR IGNORE INTO step_library
  (id, workspace_id, role, name, prompt_prefix, created_at, updated_at, deleted_at)
VALUES
  ('seed_scout', NULL, 'scout', 'Scout', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('seed_investigator', NULL, 'investigator', 'Investigate', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('seed_planner', NULL, 'planner', 'Plan', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('seed_implementer', NULL, 'implementer', 'Implement', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('seed_tester', NULL, 'tester', 'Test', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('seed_reviewer', NULL, 'reviewer', 'Review', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('seed_resolver', NULL, 'resolver', 'Resolve comments', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('seed_docs', NULL, 'docs', 'Update docs', '', CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

UPDATE step_library
SET deleted_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE workspace_id IS NULL AND deleted_at IS NULL;
`;
