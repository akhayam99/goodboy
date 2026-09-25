export const m189ArtifactOpenedKeep = `
ALTER TABLE session_artifacts ADD COLUMN opened_at INTEGER;
ALTER TABLE session_artifacts ADD COLUMN kept_at INTEGER;
ALTER TABLE session_artifacts ADD COLUMN kept_until INTEGER;
`;
