import type { ReactNode } from 'react';
import { ROW_INTERACTIVE, Reveal, cn } from '@goodboy/ui';

type Props = {
  readonly rowId: string;
  readonly icon: ReactNode;
  readonly name: ReactNode;
  readonly line: string;
  readonly trailing?: ReactNode;
  readonly panel?: ReactNode;
  readonly isPanelOpen?: boolean;
  readonly isDimmed?: boolean;
  readonly isCompact?: boolean;
  readonly onPress?: () => void;
  readonly isExpanded?: boolean;
  readonly isPressed?: boolean;
  readonly isQuiet?: boolean;
};

export const StepListRow = ({
  rowId,
  icon,
  name,
  line,
  trailing = null,
  panel = null,
  isPanelOpen = false,
  isDimmed = false,
  isCompact = false,
  onPress,
  isExpanded,
  isPressed,
  isQuiet = false,
}: Props) => {
  const rowClass = cn(
    'flex items-center gap-3 rounded-md py-2 pr-2 pl-3',
    isCompact ? 'min-h-9' : 'min-h-14',
    onPress !== undefined && cn('w-full text-left', ROW_INTERACTIVE),
    isQuiet && 'text-muted-foreground hover:text-foreground',
  );
  const content = (
    <>
      <span
        aria-hidden
        className={cn('flex size-5 shrink-0 items-center justify-center', isDimmed && 'opacity-50')}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={isQuiet ? 'text-label' : 'text-row text-foreground'}>{name}</span>
        {line === '' ? null : (
          <span
            key={line}
            className="truncate text-meta text-faint-foreground motion-safe:animate-text-swap"
          >
            {line}
          </span>
        )}
      </span>
      {trailing === null ? null : (
        <span className="flex shrink-0 items-center gap-2">{trailing}</span>
      )}
    </>
  );
  return (
    <li data-row={rowId} className="flex flex-col rounded-md">
      {onPress === undefined ? (
        <div className={rowClass}>{content}</div>
      ) : (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-pressed={isPressed}
          className={rowClass}
          onClick={onPress}
        >
          {content}
        </button>
      )}
      {panel === null ? null : (
        <Reveal open={isPanelOpen} className="pr-2 pb-2 pl-11">
          {panel}
        </Reveal>
      )}
    </li>
  );
};
