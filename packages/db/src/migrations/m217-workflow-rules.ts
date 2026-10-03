export const m217WorkflowRules = `
ALTER TABLE workspaces ADD COLUMN workflow_rules TEXT;

UPDATE workspaces
SET workflow_rules = '{"autonomy":"step","spendLimitUsd":null,"spendLimitMode":"pause","spreadByHeadroom":false,"standingGuidance":"","guidanceRoles":["implementer","docs"]}';
`;
