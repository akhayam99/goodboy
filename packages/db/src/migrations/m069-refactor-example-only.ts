export const m069RefactorExampleOnly = /* sql */ `
-- Retire the five original seeded workflows (refactor, bug-fix, ship, feature,
-- exploration) and replace them with a single worked example, 'Refactor (example)'.
-- Underscores are LIKE wildcards, so escape them to avoid matching the new
-- 'wf_seed_refactor-example_*' ids when retiring the old 'wf_seed_refactor_*' ones.

UPDATE workflows
SET deleted_at = strftime('%s','now')
WHERE deleted_at IS NULL
  AND (
    id LIKE 'wf\\_seed\\_refactor\\_%' ESCAPE '\\'
    OR id LIKE 'wf\\_seed\\_bug-fix\\_%' ESCAPE '\\'
    OR id LIKE 'wf\\_seed\\_ship\\_%' ESCAPE '\\'
    OR id LIKE 'wf\\_seed\\_feature\\_%' ESCAPE '\\'
    OR id LIKE 'wf\\_seed\\_exploration\\_%' ESCAPE '\\'
  );

INSERT OR IGNORE INTO workflows
  (id, workspace_id, name, description, goal, created_at, updated_at, is_preset)
SELECT
  'wf_seed_refactor-example_' || w.id,
  w.id,
  'Refactor (example)',
  'A worked example: scout the area, plan the change, implement it, then test. Clone it and tune each step, or build your own from scratch.',
  'Restructure the target code without changing its behavior, keeping tests green throughout.',
  datetime('now'),
  datetime('now'),
  1
FROM workspaces w;

INSERT OR IGNORE INTO steps
  (id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix,
   provider_override, model_override, effort, verbosity, parallel_group, deleted_at)
SELECT
  'step_seed_refactor-example_scout_' || w.id,
  'wf_seed_refactor-example_' || w.id,
  'seed_scout',
  'scout',
  0,
  'Scout',
  'Search the docs and the code for everything relevant to the goal. List the files in scope, the key abstractions, who calls them, and the tests that cover them. Back each entry with a file:line reference. Do not modify any code or propose changes yet.',
  NULL, NULL, NULL, NULL, NULL, NULL
FROM workspaces w;

INSERT OR IGNORE INTO steps
  (id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix,
   provider_override, model_override, effort, verbosity, parallel_group, deleted_at)
SELECT
  'step_seed_refactor-example_plan_' || w.id,
  'wf_seed_refactor-example_' || w.id,
  'seed_planner',
  'planner',
  1,
  'Plan',
  'Turn the scout map into a concrete, ordered refactor plan. For each file, state exactly what stays, what moves, and what gets deleted. Order changes by risk, lowest first. Flag every test that needs updating. Do not write code.',
  NULL, NULL, NULL, NULL, NULL, NULL
FROM workspaces w;

INSERT OR IGNORE INTO steps
  (id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix,
   provider_override, model_override, effort, verbosity, parallel_group, deleted_at)
SELECT
  'step_seed_refactor-example_implement_' || w.id,
  'wf_seed_refactor-example_' || w.id,
  'seed_implementer',
  'implementer',
  2,
  'Implement',
  'Apply the refactor in small, reviewable steps that follow the plan. Keep behavior unchanged unless the plan says otherwise. Update the affected tests in lock-step. Stay within scope. No speculative cleanup.',
  NULL, NULL, NULL, NULL, NULL, NULL
FROM workspaces w;

INSERT OR IGNORE INTO steps
  (id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix,
   provider_override, model_override, effort, verbosity, parallel_group, deleted_at)
SELECT
  'step_seed_refactor-example_test_' || w.id,
  'wf_seed_refactor-example_' || w.id,
  'seed_tester',
  'tester',
  3,
  'Test',
  'Run the full test suite and confirm the refactor preserved behavior. Add coverage for any path the refactor exposed. Fix the code when a test fails. Never weaken a test to make it pass.',
  NULL, NULL, NULL, NULL, NULL, NULL
FROM workspaces w;
`;
