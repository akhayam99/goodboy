export const m222ResolveAttemptLaunch = `
ALTER TABLE resolve_attempts ADD COLUMN launch_id TEXT;
ALTER TABLE resolve_attempts ADD COLUMN retry_of_launch_id TEXT;
CREATE INDEX idx_resolve_attempts_launch ON resolve_attempts(launch_id);
`;
