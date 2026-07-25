export const m077StepExpectedOutput = /* sql */ `
ALTER TABLE steps ADD COLUMN expected_output TEXT;

UPDATE steps
SET expected_output = 'A short map of the area: relevant files, key abstractions, callers, and existing tests, each with a file:line reference.'
WHERE expected_output IS NULL
  AND id LIKE 'step\\_seed\\_refactor-example\\_scout\\_%' ESCAPE '\\';

UPDATE steps
SET expected_output = 'An ordered, per-file refactor plan with risk notes and the list of impacted tests.'
WHERE expected_output IS NULL
  AND id LIKE 'step\\_seed\\_refactor-example\\_plan\\_%' ESCAPE '\\';

UPDATE steps
SET expected_output = 'A working tree with the refactor applied and the affected tests updated in lock-step.'
WHERE expected_output IS NULL
  AND id LIKE 'step\\_seed\\_refactor-example\\_implement\\_%' ESCAPE '\\';

UPDATE steps
SET expected_output = 'A green test suite that proves behavior is unchanged, plus any new coverage the refactor required.'
WHERE expected_output IS NULL
  AND id LIKE 'step\\_seed\\_refactor-example\\_test\\_%' ESCAPE '\\';
`;
