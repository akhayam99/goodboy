export const m104PendingResolutionReplyPosted = /* sql */ `
ALTER TABLE pending_resolutions ADD COLUMN reply_posted_at INTEGER;
`;
