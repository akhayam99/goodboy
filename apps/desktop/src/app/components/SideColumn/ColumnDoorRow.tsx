import type { LucideIcon } from 'lucide-react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
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
  readonly shortcut?: string;
  readonly isCurrent: boolean;
  readonly signal?: DoorSignal | undefined;
  readonly create?: DoorCreate;
  readonly onSelect: () => void;
};

export const ColumnDoorRow = ({
  id,
  icon: Icon,
  label,
  shortcut,
  isCurrent,
  signal,
  create,
  onSelect,
}: Props) => (
  <div data-column-door-row={id} className="group/door relative">
    <button
      type="button"
      data-column-door={id}
      aria-label={signal === undefined ? label : `${label}, ${signal.fact}`}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => {
        if (isCurrent) {
          return;
        }
        onSelect();
      }}
      className={cn(
        PANE_RHYTHM.navRail.door,
        'group flex w-full min-w-0 shrink-0 items-center gap-2 rounded-md text-row motion-safe:transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        isCurrent
          ? 'cursor-default bg-selected text-foreground'
          : 'text-muted-foreground hover:bg-hover hover:text-foreground',
      )}
    >
      <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0" />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-left">{label}</span>
        {shortcut === undefined ? null : (
          <span
            aria-hidden
            className="shrink-0 text-chip text-faint-foreground opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {shortcut}
          </span>
        )}
      </span>
      <span data-door-slot="signal" className="flex w-5 shrink-0 items-center justify-end">
        {signal === undefined ? null : <DoorSignalMark signal={signal} />}
      </span>
      <span data-door-slot="action" aria-hidden className="size-6 shrink-0" />
    </button>
    {create === undefined ? null : (
      <DoorCreateButton
        id={id}
        label={create.label}
        {...(create.shortcut !== undefined && { shortcut: create.shortcut })}
        onCreate={create.onCreate}
      />
    )}
  </div>
);
