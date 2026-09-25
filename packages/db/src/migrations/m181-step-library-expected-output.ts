export const m181StepLibraryExpectedOutput = `
ALTER TABLE step_library ADD COLUMN expected_output TEXT;

ALTER TABLE step_library ADD COLUMN base_step_id TEXT;
`;
