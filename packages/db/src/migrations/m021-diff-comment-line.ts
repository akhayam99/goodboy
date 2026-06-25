export const m021DiffCommentLine = /* sql */ `
ALTER TABLE diff_comments ADD COLUMN line_number INTEGER;
ALTER TABLE diff_comments ADD COLUMN line_side TEXT CHECK (line_side IN ('old', 'new'));

CREATE INDEX idx_diff_comments_task_file_line
  ON diff_comments(task_id, file_path, line_side, line_number);
`
