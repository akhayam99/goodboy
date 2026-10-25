import { NAMES } from '../../../shared/utils/names';
import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import type { ColumnDoorId } from './columnPlace';

export type ColumnDoor = {
  readonly id: ColumnDoorId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly shortcutId?: ShortcutId;
  readonly isReference?: boolean;
};

export const COLUMN_DOORS: ReadonlyArray<ColumnDoor> = [
  { id: 'board', label: 'Sessions', icon: CONCEPT_ICONS.sessions, shortcutId: 'session.board' },
  { id: 'inbox', label: NAMES.tasks, icon: CONCEPT_ICONS.inbox },
  { id: 'workflows', label: 'Workflows', icon: CONCEPT_ICONS.workflows },
  { id: 'chat', label: 'Chat', icon: CONCEPT_ICONS.chat },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: CONCEPT_ICONS.terminal,
    shortcutId: 'terminal.studio',
  },
  { id: 'impact', label: 'Impact', icon: CONCEPT_ICONS.impact, isReference: true },
  { id: 'monitoring', label: 'Monitoring', icon: CONCEPT_ICONS.monitoring, isReference: true },
];

export type ColumnActions = {
  readonly openBoard: () => void;
  readonly openInbox: () => void;
  readonly openChat: () => void;
  readonly openWorkflows: () => void;
  readonly openTerminalStudio: () => void;
  readonly openNewChat: () => void;
  readonly openNewTerminal: () => void;
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
