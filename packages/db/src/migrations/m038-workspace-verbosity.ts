export const m038WorkspaceVerbosity = /* sql */ `
ALTER TABLE workspaces ADD COLUMN default_verbosity TEXT CHECK (default_verbosity IN ('brief', 'normal', 'verbose'));

UPDATE agents SET verbosity = 'normal' WHERE verbosity IS NULL OR verbosity NOT IN ('brief', 'normal', 'verbose');
`;
