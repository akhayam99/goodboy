import type { LucideIcon } from 'lucide-react';
import { Button, cn, ICON_SIZE, tintClasses, Tooltip } from '@goodboy/ui';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import { navEntryToneOf } from '../../../../shared/components/navEntryToneOf';
import { DoorSignalMark } from '../DoorSignalMark';
import { countTextOf } from '../countTextOf';
import type { DoorSignal } from '../doorSignal';

type Props = {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shortcut?: ShortcutId;
  readonly isCurrent: boolean;
  readonly signal?: DoorSignal | undefined;
  readonly onSelect: () => void;
};

export const ColumnToolTile = ({
  id,
  icon: Icon,
  label,
  shortcut,
  isCurrent,
  signal,
  onSelect,
}: Props) => {
  const name = signal === undefined ? label : `${label}, ${signal.fact}`;
  const isWarning = signal?.isWarning === true;
  const hasCount = signal !== undefined && !isWarning && signal.count > 0;
  return (
    <Tooltip content={name} side="bottom" {...(shortcut !== undefined && { shortcut })}>
      <Button
        variant="quiet"
        data-column-door={id}
        data-column-tile={id}
        aria-label={name}
        aria-current={isCurrent ? 'page' : undefined}
        onClick={() => {
          if (isCurrent) {
            return;
          }
          onSelect();
        }}
        className={cn(
          'relative h-12 w-full min-w-0 flex-col gap-1 px-0',
          isCurrent ? 'cursor-default bg-selected text-foreground hover:bg-selected' : 'bg-subtle',
        )}
      >
        <span
          data-tile-icon=""
          data-icon-tone={isCurrent ? navEntryToneOf({ icon: Icon }) : undefined}
          className="flex items-center justify-center"
        >
          <Icon
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(isCurrent && tintClasses(navEntryToneOf({ icon: Icon })).icon)}
          />
        </span>
        <span className="max-w-full truncate px-1">{label}</span>
        {signal === undefined ? null : (
          <span
            data-tile-slot="signal"
            className="absolute right-2 top-1.5 flex items-center justify-end"
          >
            {isWarning ? <DoorSignalMark signal={signal} /> : null}
            {hasCount ? (
              <span
                aria-hidden
                data-tile-count=""
                className="text-chip tabular-nums text-faint-foreground"
              >
                {countTextOf({ count: signal.count })}
              </span>
            ) : null}
          </span>
        )}
      </Button>
    </Tooltip>
  );
};
