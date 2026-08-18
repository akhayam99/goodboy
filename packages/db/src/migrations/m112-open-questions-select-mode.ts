export const m112OpenQuestionsSelectMode = /* sql */ `
ALTER TABLE open_questions ADD COLUMN select_mode TEXT
  CHECK (select_mode IS NULL OR select_mode IN ('one', 'many'));
`;
