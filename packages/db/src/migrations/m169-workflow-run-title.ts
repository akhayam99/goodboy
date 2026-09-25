export const m169WorkflowRunTitle = `
ALTER TABLE session_workflows ADD COLUMN title TEXT;
ALTER TABLE session_workflows ADD COLUMN title_user_edited INTEGER NOT NULL DEFAULT 0;
`;
