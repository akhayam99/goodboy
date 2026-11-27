import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { StatusDot } from '../StatusDot';
import type { WeekGridBlock } from './types';

type Props = {
  readonly block: WeekGridBlock;
  readonly fromMinute: number;
  readonly spanMinutes: number;
  readonly isSelected: boolean;
  readonly onSelect: ((key: string) => void) | null;
};

const MIN_SHARE = 5;

const BLOCK_CLASSES =
  'absolute inset-x-1 flex min-w-0 items-start gap-2 overflow-hidden rounded-md px-2 py-0.5 text-left text-chip';

export const WeekGridBlockItem = ({
  block,
  fromMinute,
  spanMinutes,
  isSelected,
  onSelect,
}: Props) => {
  const top = ((block.startMinute - fromMinute) / spanMinutes) * 100;
  const height = Math.max(((block.endMinute - block.startMinute) / spanMinutes) * 100, MIN_SHARE);
  const isQuiet = block.isQuiet === true;
  const look = cn(
    BLOCK_CLASSES,
    isQuiet
      ? 'border border-border-soft text-faint-foreground'
      : 'border border-border-soft bg-elevated text-foreground',
    isSelected && 'bg-selected',
  );
  const content = (
    <>
      <span className="flex h-4 shrink-0 items-center">
        <StatusDot tone="neutral" color={block.color} size="sm" />
      </span>
      <span className="min-w-0 truncate">{block.title}</span>
    </>
  );
  const style = { top: `${top}%`, height: `${height}%` };
  if (onSelect === null) {
    return (
      <li data-week-block={block.key} aria-label={block.ariaLabel} className={look} style={style}>
        {content}
      </li>
    );
  }
  return (
    <li className="contents">
      <button
        type="button"
        data-week-block={block.key}
        aria-label={block.ariaLabel}
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(block.key)}
        className={cn(look, FOCUS_RING, 'hover:border-border')}
        style={style}
      >
        {content}
      </button>
    </li>
  );
};
