import { useMemo } from 'react';
import { cn } from '@goodboy/ui';
import { LINE_FILL, SIGN_TEXT } from '../../diff/lib/lineTone';
import { threadLocationOf } from '../../resolve/threadLocationOf';
import type { ReviewEntry } from '../../resolve/components/ReviewFlow/useReviewEntries';
import { useBranchDiff } from '../branchDiffContext';
import { hunkAround } from '../hunkAround';

type Props = {
  readonly entry: ReviewEntry;
  readonly onOpenInDiff: (() => void) | null;
};

const SIGN = { add: '+', del: '-', context: ' ' } as const;

export const ThreadHunk = ({ entry, onOpenInDiff }: Props) => {
  const diff = useBranchDiff();
  const location = threadLocationOf({ row: entry.row });
  const window = useMemo(
    () =>
      diff === null || location === null || location.path === null
        ? null
        : hunkAround({ files: diff.files, path: location.path, line: location.line }),
    [diff, location],
  );
  if (window === null) {
    return null;
  }
  const header = (
    <span className="min-w-0 truncate font-mono text-meta text-faint-foreground">
      {window.path.split('/').pop()} {window.from}-{window.to}
    </span>
  );
  return (
    <figure
      aria-label="Code around the comment"
      className="min-w-0 overflow-hidden rounded-lg bg-subtle py-2 font-mono text-code"
    >
      <figcaption className="px-3 pb-1">
        {onOpenInDiff === null ? (
          header
        ) : (
          <button
            type="button"
            onClick={onOpenInDiff}
            className="max-w-full rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {header}
          </button>
        )}
      </figcaption>
      {window.lines.map((line, index) => (
        <p
          key={`${line.oldLine ?? 'n'}-${line.newLine ?? 'n'}-${index}`}
          className={cn('flex min-w-0 gap-3 px-3', LINE_FILL[line.kind])}
        >
          <span aria-hidden className="w-8 shrink-0 text-right text-faint-foreground tabular-nums">
            {line.newLine ?? line.oldLine}
          </span>
          <span aria-hidden className={cn('w-2 shrink-0', SIGN_TEXT[line.kind])}>
            {SIGN[line.kind]}
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-foreground">
            {line.text}
          </span>
        </p>
      ))}
    </figure>
  );
};
