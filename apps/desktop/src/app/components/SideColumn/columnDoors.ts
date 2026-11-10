import type { LucideIcon } from 'lucide-react';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { DESTINATIONS, type Destination } from '../../../shared/navigation/destinations';
import type { ColumnDoorId } from '../../../shared/navigation/columnPlace';

export type ColumnDoor = {
  readonly id: ColumnDoorId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly shortcutId?: ShortcutId;
  readonly isReference?: boolean;
  readonly isTool?: boolean;
};

type DoorDestination = Destination & { readonly id: ColumnDoorId };

type DoorParams = {
  readonly destination: DoorDestination;
};

const doorOf = ({ destination }: DoorParams): ColumnDoor => ({
  id: destination.id,
  label: destination.label,
  icon: destination.icon,
  ...(destination.shortcutId !== undefined && { shortcutId: destination.shortcutId }),
  ...(destination.isReference === true && { isReference: true }),
  ...(destination.home === 'tile' && { isTool: true }),
});

export const COLUMN_DOORS: ReadonlyArray<ColumnDoor> = DESTINATIONS.filter(
  (destination): destination is DoorDestination =>
    destination.home === 'column' || destination.home === 'tile',
).map((destination) => doorOf({ destination }));

export const COLUMN_ROW_DOORS: ReadonlyArray<ColumnDoor> = COLUMN_DOORS.filter(
  (door) => door.isTool !== true,
);

export const COLUMN_TOOL_DOORS: ReadonlyArray<ColumnDoor> = COLUMN_DOORS.filter(
  (door) => door.isTool === true,
);

export type ColumnActions = {
  readonly openBoard: () => void;
  readonly openInbox: () => void;
  readonly openChat: () => void;
  readonly openWorkflows: () => void;
  readonly openTerminalStudio: () => void;
  readonly openBrowserStudio: () => void;
  readonly openNewChat: () => void;
  readonly openMonitoring: () => void;
  readonly openImpact: () => void;
  readonly openSettings: () => void;
  readonly openChangelog: () => void;
  readonly openGuide: () => void;
  readonly openShortcuts: () => void;
};

type OpenDoorParams = {
  readonly id: ColumnDoorId;
  readonly actions: ColumnActions;
};

export const openColumnDoor = ({ id, actions }: OpenDoorParams): void => {
  switch (id) {
    case 'board':
      actions.openBoard();
      return;
    case 'inbox':
      actions.openInbox();
      return;
    case 'chat':
      actions.openChat();
      return;
    case 'workflows':
      actions.openWorkflows();
      return;
    case 'terminal':
      actions.openTerminalStudio();
      return;
    case 'browser':
      actions.openBrowserStudio();
      return;
    case 'monitoring':
      actions.openMonitoring();
      return;
    case 'impact':
      actions.openImpact();
      return;
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
};
