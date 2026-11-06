import { ROW_INTERACTIVE, Skeleton, StatusDot, cn } from '@goodboy/ui';
import type { StatusCell, StatusTarget } from './statusCell';

type Props = {
  readonly cells: ReadonlyArray<StatusCell>;
  readonly onOpen: (target: StatusTarget) => void;
};

const CELL = 'flex min-w-0 flex-col gap-1 bg-subtle px-3 py-2 text-left';

export const PullRequestStatusStrip = ({ cells, onOpen }: Props) => (
  <div
    role="group"
    aria-label="Status"
    data-pr-status-strip=""
    className="grid min-w-0 grid-cols-4 gap-px overflow-hidden rounded-lg bg-border-soft"
  >
    {cells.map((cell) => {
      const opens = cell.opens;
      if (cell.isPending === true) {
        return (
          <div key={cell.id} data-cell={cell.id} data-pending="" aria-busy="true" className={CELL}>
            <span className="text-meta text-muted-foreground">{cell.label}</span>
            <span className="flex h-4 items-center">
              <Skeleton className="h-3 w-3/5 rounded-sm" />
            </span>
            <span className="min-h-4" />
          </div>
        );
      }
      const content = (
        <>
          <span className="text-meta text-muted-foreground">{cell.label}</span>
          <span className="flex min-w-0 items-center gap-2 text-meta text-foreground">
            <StatusDot tone={cell.tone} size="sm" />
            <span className="min-w-0 truncate">{cell.word}</span>
          </span>
          <span className="min-h-4 min-w-0 truncate text-meta text-faint-foreground">
            {cell.detail ?? ''}
          </span>
        </>
      );
      if (opens === null) {
        return (
          <div key={cell.id} data-cell={cell.id} data-tone={cell.tone} className={CELL}>
            {content}
          </div>
        );
      }
      return (
        <button
          key={cell.id}
          type="button"
          data-cell={cell.id}
          data-tone={cell.tone}
          aria-label={`${cell.label}: ${cell.word}`}
          className={cn(CELL, ROW_INTERACTIVE)}
          onClick={() => onOpen(opens)}
        >
          {content}
        </button>
      );
    })}
  </div>
);
