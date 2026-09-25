export const m186ResolveCommitLinks = `
ALTER TABLE resolve_threads ADD COLUMN fixup_of_sha TEXT;
ALTER TABLE resolve_threads ADD COLUMN replaces_sha TEXT;
`;
