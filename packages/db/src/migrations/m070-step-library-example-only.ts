export const m070StepLibraryExampleOnly = /* sql */ `
UPDATE step_library SET deleted_at = strftime('%s','now')
WHERE id IN ('seed_reviewer','seed_investigator','seed_architect','seed_explorer','seed_product')
  AND workspace_id IS NULL AND deleted_at IS NULL;
`;
