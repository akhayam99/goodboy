import type { HistoryOnlineCommit } from '@goodboy/types';
import { withOperatorNotes } from '../chat/utils/withOperatorNotes';

type Kept = {
  readonly remoteSha: string;
  readonly commits: ReadonlyArray<HistoryOnlineCommit>;
};

type Params = {
  readonly branch: string;
  readonly command: string;
  readonly output: string;
  readonly hint?: string;
  readonly pending?: string;
  readonly kept?: Kept | null;
};

type KeptParams = {
  readonly branch: string;
  readonly kept: Kept | null;
};

const OUTPUT_LIMIT = 6000;
const SHORT_SHA = 7;

const keptLines = ({ branch, kept }: KeptParams): ReadonlyArray<string> => {
  if (kept === null || kept.commits.length === 0) {
    return [];
  }
  return [
    `Origin moved after the push was confirmed. origin/${branch} is now at ${kept.remoteSha} and has commits this branch lacks:`,
    ...kept.commits.map(
      (commit) => `- ${commit.sha.slice(0, SHORT_SHA)} ${commit.subject} (${commit.author})`,
    ),
    `Nobody confirmed dropping them, so keep them: rebase this branch onto ${kept.remoteSha} and resolve any conflict so both sides survive. Never force push them away.`,
    '',
  ];
};

export const pushFixBrief = ({
  branch,
  command,
  output,
  hint = '',
  pending = '',
  kept = null,
}: Params): string => {
  const trimmed = output.trim();
  const shown = trimmed.length > OUTPUT_LIMIT ? trimmed.slice(-OUTPUT_LIMIT) : trimmed;
  const waiting = pending.trim();
  const brief = [
    `The push of ${branch} failed. Fix the cause in this worktree so the push can go through.`,
    '',
    ...keptLines({ branch, kept }),
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
