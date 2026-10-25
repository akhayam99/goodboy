import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button, ICON_SIZE, Skeleton } from '@goodboy/ui';

import type { ContextGap } from '../../lib/contextGaps';
import type { ExpandContextParams } from '../../hooks/useFileSides';

type Props = {
  readonly gap: ContextGap;
  readonly rowIndex: number;
  readonly hasNextHunk: boolean;
  readonly hasPreviousHunk: boolean;
  readonly isPending: boolean;
  readonly hasError: boolean;
  readonly retryDirection: ExpandContextParams['direction'];
  readonly isTooLarge: boolean;
  readonly onExpand: (params: ExpandContextParams) => Promise<void>;
  readonly onOpenInEditor: (() => void) | null;
};

export const GapRow = ({
  gap,
  rowIndex,
  hasNextHunk,
  hasPreviousHunk,
  isPending,
  hasError,
  retryDirection,
  isTooLarge,
  onExpand,
  onOpenInEditor,
}: Props) => {
  const reveal = ({ index, direction: nextDirection }: ExpandContextParams) => {
    void onExpand({ index, direction: nextDirection });
  };
  const isShort = gap.count !== null && gap.count <= gap.revealCount;
  return (
    <div role="row" aria-rowindex={rowIndex} data-slot="diff-gap" className="flex h-7 bg-subtle">
      <div
        role="gridcell"
        className="flex min-w-0 flex-1 items-center justify-center gap-2 px-3 text-meta text-faint-foreground"
      >
        {isTooLarge ? (
          <>
            <span>This file is too large to expand here.</span>
            {onOpenInEditor === null ? null : (
              <Button size="sm" variant="ghost" onClick={onOpenInEditor}>
                Open in editor
              </Button>
            )}
          </>
        ) : hasError ? (
          <>
            <span>Couldn't load the lines</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => reveal({ index: gap.index, direction: retryDirection })}
            >
              Retry
            </Button>
          </>
        ) : isPending ? (
          <span
            role="status"
            aria-label="Loading unchanged lines"
            className="flex items-center gap-2"
          >
            <Skeleton className="h-3 w-8 rounded-sm" />
            Loading lines
          </span>
        ) : isShort ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => reveal({ index: gap.index, direction: 'all' })}
          >
            Show {gap.count} lines
          </Button>
        ) : (
          <>
            {!hasNextHunk || gap.count === null ? null : (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Show ${gap.revealCount} preceding lines`}
                onClick={() => reveal({ index: gap.index, direction: 'up' })}
              >
                <ArrowUp size={ICON_SIZE.row} aria-hidden />
                Show {gap.revealCount} lines
              </Button>
            )}
            {hasPreviousHunk ? (
              <Button
                size="sm"
                variant="ghost"
                aria-label={
                  gap.count === null ? 'Show more lines' : `Show ${gap.revealCount} following lines`
                }
                onClick={() => reveal({ index: gap.index, direction: 'down' })}
              >
                <ArrowDown size={ICON_SIZE.row} aria-hidden />
                {gap.count === null ? 'Show more lines' : `Show ${gap.revealCount} lines`}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => reveal({ index: gap.index, direction: 'all' })}
            >
              {gap.count === null ? 'Show all lines' : `Show ${gap.count} lines`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
