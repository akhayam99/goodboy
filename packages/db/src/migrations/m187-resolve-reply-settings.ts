export const m187ResolveReplySettings = `
ALTER TABLE workspaces ADD COLUMN reply_voice TEXT CHECK (reply_voice IS NULL OR reply_voice IN ('terse', 'friendly', 'formal', 'mine'));
ALTER TABLE workspaces ADD COLUMN reply_style_note TEXT;
ALTER TABLE workspaces ADD COLUMN reply_template_fixed TEXT;
ALTER TABLE workspaces ADD COLUMN reply_template_no_change TEXT;
ALTER TABLE workspaces ADD COLUMN resolve_on_github INTEGER;
ALTER TABLE workspaces ADD COLUMN resolve_commit_style TEXT CHECK (resolve_commit_style IS NULL OR resolve_commit_style IN ('new', 'fixup'));
ALTER TABLE projects ADD COLUMN reply_voice TEXT CHECK (reply_voice IS NULL OR reply_voice IN ('terse', 'friendly', 'formal', 'mine'));
ALTER TABLE projects ADD COLUMN reply_style_note TEXT;
ALTER TABLE projects ADD COLUMN reply_template_fixed TEXT;
ALTER TABLE projects ADD COLUMN reply_template_no_change TEXT;
ALTER TABLE projects ADD COLUMN resolve_on_github INTEGER;
ALTER TABLE projects ADD COLUMN resolve_commit_style TEXT CHECK (resolve_commit_style IS NULL OR resolve_commit_style IN ('new', 'fixup'));
`;
