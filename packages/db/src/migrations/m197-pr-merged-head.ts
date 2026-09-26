export const m197PrMergedHead = `
ALTER TABLE mount_pr_links ADD COLUMN merged_head_sha TEXT;
ALTER TABLE mount_pr_links ADD COLUMN merged_at INTEGER;
`;
