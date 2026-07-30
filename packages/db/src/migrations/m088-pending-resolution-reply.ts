export const m088PendingResolutionReply = /* sql */ `
ALTER TABLE pending_resolutions ADD COLUMN reply TEXT;
ALTER TABLE pending_resolutions ADD COLUMN outcome TEXT;
`;
