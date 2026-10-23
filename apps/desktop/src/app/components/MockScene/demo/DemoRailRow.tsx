import { Check } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';

type Props = {
  readonly chapter: DemoChapter;
  readonly ordinal: number;
  readonly isActive: boolean;
  readonly isVisited: boolean;
  readonly onSelect: () => void;
};

export const DemoRailRow = ({ chapter, ordinal, isActive, isVisited, onSelect }: Props) => (
  <button
    type="button"
    onClick={onSelect}
    aria-current={isActive ? 'step' : undefined}
    data-selected={isActive ? 'true' : 'false'}
    className={cn(
      'grid w-full grid-cols-[20px_minmax(0,1fr)_14px] items-start gap-3 rounded-lg px-3 py-2 text-left',
      ROW_INTERACTIVE,
      'data-[selected=true]:bg-selected data-[selected=true]:hover:bg-selected',
    )}
  >
    <span className={cn('text-meta', isActive ? 'text-primary' : 'text-faint-foreground')}>
      {String(ordinal).padStart(2, '0')}
    </span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={cn('text-row', isActive ? 'text-foreground' : 'text-muted-foreground')}>
        {chapter.title}
      </span>
      <span className="truncate text-meta text-faint-foreground">{chapter.summary}</span>
    </span>
    {isVisited && !isActive ? (
      <Check aria-label="Seen" size={ICON_SIZE.row} className="self-center text-faint-foreground" />
    ) : (
      <span aria-hidden />
    )}
  </button>
);
