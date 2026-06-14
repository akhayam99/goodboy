export const m061DiffCommentLineRange = /* sql */ `
ALTER TABLE diff_comments ADD COLUMN end_line_number INTEGER;
`;
