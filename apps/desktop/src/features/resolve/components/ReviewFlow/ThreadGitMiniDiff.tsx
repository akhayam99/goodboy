import { cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { LINE_FILL, SIGN_TEXT } from '../../../diff/lib/lineTone';
import { useOriginCommitDiff } from '../../hooks/useOriginCommitDiff';
import { inlineChangePlan } from '../../inlineChangePlan';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

const SIGN = { add: '+', del: '-', context: ' ' } as const;
const MINI_DIFF_LINES = 6;

export const ThreadGitMiniDiff = ({ sessionId, entry }: Props) => {
  const fix = entry.facts?.elsewhere ?? null;
  const files = useOriginCommitDiff({
    sessionId,
    sha: fix?.origin === 'commit' ? fix.sha : null,
    path: fix?.path ?? null,
    fallbackWorktreePath: entry.row.attempt?.mountTarget?.worktreePath ?? null,
  });
  const lines = inlineChangePlan({ files }).files[0]?.hunks[0]?.lines.slice(0, MINI_DIFF_LINES);
  if (lines === undefined || lines.length === 0) {
    return null;
  }
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-background py-1.5 font-mono text-code">
      {lines.map((line, index) => (
        <p key={index} className={cn('flex min-w-0 gap-3 px-3', LINE_FILL[line.kind])}>
          <span aria-hidden className={cn('w-2 shrink-0', SIGN_TEXT[line.kind])}>
            {SIGN[line.kind]}
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-foreground">
            {line.text}
          </span>
        </p>
      ))}
    </div>
  );
};
