import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import type { HintTally } from './hints/hintTally';

type Props = {
  readonly chapter: DemoChapter;
  readonly ordinal: number;
  readonly isActive: boolean;
  readonly tally: HintTally;
  readonly onSelect: () => void;
};

export const DemoRailRow = ({ chapter, ordinal, isActive, tally, onSelect }: Props) => (
  <button
    type="button"
    onClick={onSelect}
    aria-current={isActive ? 'page' : undefined}
    data-selected={isActive ? 'true' : 'false'}
    className={cn(
      'grid w-full grid-cols-[20px_minmax(0,1fr)] items-baseline gap-3 rounded-lg px-3 py-2 text-left',
      ROW_INTERACTIVE,
      'data-[selected=true]:bg-selected data-[selected=true]:hover:bg-selected',
    )}
  >
    <span className={cn('text-meta', isActive ? 'text-primary' : 'text-faint-foreground')}>
      {String(ordinal).padStart(2, '0')}
    </span>
    <span className="flex min-w-0 flex-col">
      <span className="flex items-baseline gap-2">
        <span className={cn('text-row', isActive ? 'text-foreground' : 'text-muted-foreground')}>
          {chapter.title}
        </span>
        {chapter.isOptional === true ? (
          <span className="text-meta text-faint-foreground">Optional</span>
        ) : null}
      </span>
      {tally.total > 0 ? (
        <span
          className={cn(
            'text-meta',
            tally.tried > 0 ? 'text-muted-foreground' : 'text-faint-foreground',
          )}
        >
          {tally.tried} of {tally.total} tried
        </span>
      ) : null}
    </span>
  </button>
);
