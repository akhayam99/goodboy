import { withOperatorNotes } from '../chat/utils/withOperatorNotes';

type Params = {
  readonly branch: string;
  readonly command: string;
  readonly output: string;
  readonly hint?: string;
  readonly pending?: string;
};

const OUTPUT_LIMIT = 6000;

export const pushFixBrief = ({
  branch,
  command,
  output,
  hint = '',
  pending = '',
}: Params): string => {
  const trimmed = output.trim();
  const shown = trimmed.length > OUTPUT_LIMIT ? trimmed.slice(-OUTPUT_LIMIT) : trimmed;
  const waiting = pending.trim();
  const brief = [
    `The push of ${branch} failed. Fix the cause in this worktree so the push can go through.`,
    '',
    `Command: ${command}`,
    'Output:',
    shown === '' ? '(no output)' : shown,
    '',
    'If a hook stopped the push (pre-push, commitlint, lint, tests), fix what it reports and commit the fix on this branch.',
    'Never skip a hook: no --no-verify, no disabled check, no edited hook config. If dependencies are missing or stale, install them in this worktree with its package manager.',
    'Never run git push or git push --force yourself, never edit the remote, and never rewrite commits that are already online. Goodboy pushes again with its lease checks when you finish.',
    ...(waiting === ''
      ? []
      : [
          '',
          'Waiting on this push:',
          waiting,
          "Goodboy does this after the push goes through. Don't do it yourself.",
        ]),
    'End with one line saying what you changed.',
  ].join('\n');
  return withOperatorNotes({ text: brief, hint });
};
