type Params = {
  readonly branch: string;
  readonly command: string;
  readonly output: string;
};

const OUTPUT_LIMIT = 6000;

export const pushFixBrief = ({ branch, command, output }: Params): string => {
  const trimmed = output.trim();
  const shown = trimmed.length > OUTPUT_LIMIT ? trimmed.slice(-OUTPUT_LIMIT) : trimmed;
  return [
    `The push of ${branch} failed. Fix the cause in this worktree so the push can go through.`,
    '',
    `Command: ${command}`,
    'Output:',
    shown === '' ? '(no output)' : shown,
    '',
    'If a hook stopped the push (pre-push, commitlint, lint, tests), fix what it reports and commit the fix on this branch.',
    'Never run git push or git push --force yourself, never edit the remote, and never rewrite commits that are already online. Goodboy pushes again with its lease checks when you finish.',
    'End with one line saying what you changed.',
  ].join('\n');
};
