export const HISTORY_REASON_COPY: Readonly<Record<string, string>> = {
  'status-unreadable': "Couldn't read the worktree status.",
  'untracked-unreadable': "Couldn't list the untracked files here, so nothing was changed.",
  'rewritten-unreadable': "Couldn't read the rewritten files, so nothing was changed.",
  'changed-unreadable': "Couldn't read the changed files, so nothing was changed.",
  'case-unreadable':
    "Couldn't check how this folder treats upper and lower case, so nothing was changed.",
};
