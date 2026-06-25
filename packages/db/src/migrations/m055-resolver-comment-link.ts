export const m055ResolverCommentLink = /* sql */ `
ALTER TABLE agents ADD COLUMN source_thread_id TEXT;
ALTER TABLE agents ADD COLUMN source_comment_url TEXT;
`
