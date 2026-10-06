import { SquareKanban, type LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import type { ColumnDoorId } from './columnPlace';

export type ColumnDoor = {
  readonly id: ColumnDoorId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly shortcutId?: ShortcutId;
};

export const COLUMN_DOORS: ReadonlyArray<ColumnDoor> = [
  { id: 'board', label: 'Board', icon: SquareKanban, shortcutId: 'session.board' },
  { id: 'inbox', label: 'Inbox', icon: CONCEPT_ICONS.inbox },
  { id: 'chat', label: 'Chat', icon: CONCEPT_ICONS.chat },
  { id: 'workflows', label: 'Workflows', icon: CONCEPT_ICONS.workflows },
];

export type ColumnActions = {
  readonly openBoard: () => void;
  readonly openInbox: () => void;
  readonly openChat: () => void;
  readonly openWorkflows: () => void;
  readonly openSettings: () => void;
  readonly openChangelog: () => void;
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
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
};
