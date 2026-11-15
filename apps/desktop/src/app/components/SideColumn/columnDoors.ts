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
  readonly badge?: string;
};

type DoorDestination = Destination & { readonly id: ColumnDoorId };

type DoorParams = {
  readonly destination: DoorDestination;
};

const DOOR_BADGES: Readonly<Partial<Record<ColumnDoorId, string>>> = { work: 'New' };

const doorOf = ({ destination }: DoorParams): ColumnDoor => {
  const badge = DOOR_BADGES[destination.id];
  return {
    id: destination.id,
    label: destination.label,
    icon: destination.icon,
    ...(destination.shortcutId !== undefined && { shortcutId: destination.shortcutId }),
    ...(destination.isReference === true && { isReference: true }),
    ...(badge !== undefined && { badge }),
  };
};

export const COLUMN_DOORS: ReadonlyArray<ColumnDoor> = DESTINATIONS.filter(
  (destination): destination is DoorDestination => destination.home === 'column',
).map((destination) => doorOf({ destination }));

type DoorsParams = {
  readonly isWork: boolean;
};

export const columnDoorsOf = ({ isWork }: DoorsParams): ReadonlyArray<ColumnDoor> =>
  isWork ? COLUMN_DOORS : COLUMN_DOORS.filter((door) => door.id !== 'work');

export type ColumnActions = {
  readonly openBoard: () => void;
  readonly openInbox: () => void;
  readonly openWork: () => void;
  readonly openChat: () => void;
  readonly openWorkflows: () => void;
  readonly openNewChat: () => void;
  readonly openMonitoring: () => void;
  readonly openImpact: () => void;
  readonly openSettings: () => void;
  readonly openChangelog: () => void;
  readonly openGuide: () => void;
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
    case 'work':
      actions.openWork();
      return;
    case 'chat':
      actions.openChat();
      return;
    case 'workflows':
      actions.openWorkflows();
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
