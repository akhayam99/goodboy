import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn, ICON_SIZE, PANE_RHYTHM, tintClasses, Tooltip, FOCUS_RING } from '@goodboy/ui';
import type { ShortcutId } from '../../../shared/keyboard/registry';

import { navEntryToneOf } from '../../../shared/components/navEntryToneOf';
import { DoorCreateButton } from './DoorCreateButton';
import { DoorSignalMark } from './DoorSignalMark';
import type { DoorSignal } from './doorSignal';

type DoorCreate = {
  readonly label: string;
  readonly shortcut?: ShortcutId;
  readonly onCreate: () => void;
};

type Props = {
  readonly id: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shortcut?: ShortcutId;
  readonly isCurrent: boolean;
  readonly isQuiet?: boolean;
  readonly signal?: DoorSignal | undefined;
  readonly create?: DoorCreate;
  readonly action?: ReactNode;
  readonly onSelect: () => void;
};

export const ColumnDoorRow = ({
  id,
  icon: Icon,
  label,
  shortcut,
  isCurrent,
  isQuiet = false,
  signal,
  create,
  action,
  onSelect,
}: Props) => {
  const name = signal === undefined ? label : `${label}, ${signal.fact}`;
  const hasAction = create !== undefined || (action !== undefined && action !== null);
  const door = (
    <button
      type="button"
      data-column-door={id}
      aria-label={name}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => {
        if (isCurrent) {
          return;
        }
        onSelect();
      }}
      className={cn(
        PANE_RHYTHM.navRail.door,
        'group flex w-full min-w-0 shrink-0 items-center gap-2 rounded-md motion-safe:transition-colors',
        FOCUS_RING,
        'text-ui',
        isCurrent
          ? 'cursor-default bg-selected text-foreground'
          : cn(
              isQuiet ? 'text-faint-foreground' : 'text-muted-foreground',
              'hover:bg-hover hover:text-foreground',
            ),
      )}
    >
      <span
        data-nav-icon=""
        data-icon-tone={isCurrent ? navEntryToneOf({ icon: Icon }) : undefined}
        className={PANE_RHYTHM.navRail.icon}
      >
        <Icon
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(isCurrent && tintClasses(navEntryToneOf({ icon: Icon })).icon)}
        />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-left">{label}</span>
      </span>
      {hasAction ? <span data-door-slot="action" aria-hidden className="size-6 shrink-0" /> : null}
      <span data-door-slot="signal" className={PANE_RHYTHM.navRail.mark}>
        {signal === undefined ? null : <DoorSignalMark signal={signal} />}
      </span>
    </button>
  );
  return (
    <div data-column-door-row={id} className="group/door relative">
      {signal === undefined && shortcut === undefined ? (
        door
      ) : (
        <Tooltip content={name} side="right" {...(shortcut !== undefined && { shortcut })}>
          {door}
        </Tooltip>
      )}
      {create === undefined ? null : (
        <DoorCreateButton
          id={id}
          label={create.label}
          {...(create.shortcut !== undefined && { shortcut: create.shortcut })}
          onCreate={create.onCreate}
        />
      )}
      {action === undefined || action === null ? null : (
        <div data-door-action={id} className={PANE_RHYTHM.navRail.action}>
          {action}
        </div>
      )}
    </div>
  );
};
