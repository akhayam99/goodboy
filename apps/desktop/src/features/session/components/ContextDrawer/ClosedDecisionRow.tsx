import { ArrowRight, Undo2 } from 'lucide-react';
import { Button, Markdown, cn } from '@goodboy/ui';
import { DecisionNumber } from './DecisionNumber';
import type { ClosedDecisionByline } from './decisionByline';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly number: number;
  readonly isHighlighted: boolean;
  readonly rowRef: (element: HTMLDivElement | null) => void;
  readonly text: string;
  readonly reason: string | null;
  readonly byline: ClosedDecisionByline;
  readonly isLocked: boolean;
  readonly onJump: (number: number) => void;
  readonly onRestore: (() => void) | null;
};

export const ClosedDecisionRow = ({
  number,
  isHighlighted,
  rowRef,
  text,
  reason,
  byline,
  isLocked,
  onJump,
  onRestore,
}: Props) => (
  <div
    ref={rowRef}
    data-decision={number}
    className={cn(
      'flex items-start gap-3 rounded-lg px-2 py-2 motion-safe:transition-colors',
      isHighlighted && 'bg-selected',
    )}
  >
    <DecisionNumber number={number} isClosed />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="line-clamp-2 text-faint-foreground line-through [overflow-wrap:anywhere]">
        <Markdown text={text} className="text-label" />
      </div>
      <p className="flex flex-wrap items-center gap-1 text-meta text-faint-foreground">
        <span>{`${byline.author} · ${byline.verb}`}</span>
        {byline.target === null ? null : (
          <button
            type="button"
            aria-label={`Go to decision ${byline.target}`}
            onClick={() => onJump(byline.target ?? number)}
            className="inline-flex items-center gap-0.5 rounded-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ArrowRight size={10} aria-hidden />
            {byline.target}
          </button>
        )}
        {byline.closer === null ? null : <span>{`· ${byline.closer}`}</span>}
      </p>
      {reason === null ? null : <p className="text-meta text-faint-foreground">{`"${reason}"`}</p>}
    </div>
    {onRestore === null || isLocked ? null : (
      <Button variant="ghost" size="sm" onClick={onRestore}>
        <Undo2 size={ICON_SIZE.row} aria-hidden />
        Restore
      </Button>
    )}
  </div>
);
