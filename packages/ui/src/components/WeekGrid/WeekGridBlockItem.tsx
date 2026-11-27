import { cn } from '../../cn';
import { SelectableRow } from '../SelectableRow';
import { StatusDot } from '../StatusDot';
import type { BlockLane } from './blockLanesOf';
import { blockShareOf } from './blockShareOf';
import type { WeekGridBlock } from './types';

type Props = {
  readonly block: WeekGridBlock;
  readonly place: BlockLane;
  readonly fromMinute: number;
  readonly spanMinutes: number;
  readonly isSelected: boolean;
  readonly onSelect: ((key: string) => void) | null;
};

const PLACE_CLASSES = 'absolute flex min-w-0';

const BLOCK_CLASSES =
  'flex h-full min-w-0 flex-1 items-start gap-2 overflow-hidden rounded-md px-2 py-0.5 text-left text-chip';

export const WeekGridBlockItem = ({
  block,
  place,
  fromMinute,
  spanMinutes,
  isSelected,
  onSelect,
}: Props) => {
  const top = ((block.startMinute - fromMinute) / spanMinutes) * 100;
  const height = blockShareOf({ block, spanMinutes });
  const width = 100 / place.laneCount;
  const isQuiet = block.isQuiet === true;
  const look = cn(
    BLOCK_CLASSES,
    isQuiet
      ? 'border border-border-soft text-faint-foreground'
      : 'border border-border-soft bg-elevated text-foreground',
  );
  const content = (
    <>
      <span className="flex h-4 shrink-0 items-center">
        <StatusDot tone="neutral" color={block.color} size="sm" />
      </span>
      <span className="min-w-0 truncate">{block.title}</span>
    </>
  );
  const style = {
    top: `${top}%`,
    height: `${height}%`,
    left: `calc(${place.lane * width}% + 0.25rem)`,
    width: `calc(${width}% - 0.5rem)`,
  };
  if (onSelect === null) {
    return (
      <li
        data-week-block={block.key}
        aria-label={block.ariaLabel}
        className={cn(PLACE_CLASSES, look)}
        style={style}
      >
        {content}
      </li>
    );
  }
  return (
    <li data-week-block={block.key} className={PLACE_CLASSES} style={style}>
      <SelectableRow
        selected={isSelected}
        ariaLabel={block.ariaLabel}
        ariaCurrent={isSelected ? 'true' : undefined}
        onClick={() => onSelect(block.key)}
        className={cn(look, 'hover:border-border')}
      >
        {content}
      </SelectableRow>
    </li>
  );
};
