import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { ColumnDoorId, ColumnPlace } from '../columnPlace';
import { COLUMN_TOOL_DOORS, openColumnDoor, type ColumnActions } from '../columnDoors';
import type { DoorSignal } from '../doorSignal';
import { ColumnToolTile } from './ColumnToolTile';

type Props = {
  readonly place: ColumnPlace;
  readonly actions: ColumnActions;
  readonly signals: Partial<Record<ColumnDoorId, DoorSignal>>;
  readonly onNavigate?: () => void;
};

export const ColumnToolTiles = ({ place, actions, signals, onNavigate }: Props) => {
  return (
    <div
      role="group"
      aria-label="Tools"
      data-column-tiles=""
      className={cn('grid shrink-0 grid-flow-col auto-cols-fr', PANE_RHYTHM.navRail.doorGap)}
    >
      {COLUMN_TOOL_DOORS.map((door) => (
        <ColumnToolTile
          key={door.id}
          id={door.id}
          icon={door.icon}
          label={door.label}
          {...(door.shortcutId !== undefined && { shortcut: door.shortcutId })}
          isCurrent={place === door.id}
          signal={signals[door.id]}
          onSelect={() => {
            openColumnDoor({ id: door.id, actions });
            onNavigate?.();
          }}
        />
      ))}
    </div>
  );
};
