import { ChevronRight } from 'lucide-react';
import { cn, Eyebrow, ICON_SIZE, Tooltip, type Tone } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly total: number | null;
  readonly tone?: Tone;
  readonly title?: string;
  readonly isCollapsed?: boolean;
  readonly onToggle?: () => void;
};

export const SessionGroupHeader = ({
  label,
  total,
  tone = 'neutral',
  title,
  isCollapsed = false,
  onToggle,
}: Props) => {
  const content = (
    <>
      {onToggle === undefined ? null : (
        <ChevronRight
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0 text-faint-foreground motion-safe:transition-transform group-hover:text-muted-foreground',
            !isCollapsed && 'rotate-90',
          )}
        />
      )}
      <Eyebrow label={label} tone={tone} />
      {total === null ? null : (
        <span aria-hidden className="text-meta tabular-nums text-faint-foreground">
          {total}
        </span>
      )}
    </>
  );
  if (onToggle === undefined) {
    return <div className="flex h-6 w-full items-center gap-1 px-2">{content}</div>;
  }
  return (
    <Tooltip content={title}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        className="group flex h-6 w-full items-center gap-1 rounded-sm px-2 text-left"
      >
        {content}
      </button>
    </Tooltip>
  );
};
