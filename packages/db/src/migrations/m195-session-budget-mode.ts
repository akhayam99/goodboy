export const m195SessionBudgetMode = `
ALTER TABLE session_budgets ADD COLUMN on_exceed TEXT NOT NULL DEFAULT 'pause' CHECK (on_exceed IN ('pause', 'warn'));
`;
