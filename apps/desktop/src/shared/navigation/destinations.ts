import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../components/conceptIcons';
import type { ShortcutId } from '../keyboard/registry';
import { NAMES, formerNamesOf } from '../utils/names';

export type DestinationId =
  | 'board'
  | 'inbox'
  | 'workflows'
  | 'chat'
  | 'impact'
  | 'terminal'
  | 'browser'
  | 'monitoring'
  | 'notifications';

export type StudioDestinationId = Exclude<DestinationId, 'board'>;

export type DestinationHome = 'column' | 'tile' | 'topBar';

export type Destination = {
  readonly id: DestinationId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly menuId: string;
  readonly home: DestinationHome;
  readonly aliases: ReadonlyArray<string>;
  readonly shortcutId?: ShortcutId;
  readonly isReference?: boolean;
};

export const DESTINATIONS: ReadonlyArray<Destination> = [
  {
    id: 'board',
    label: NAMES.board,
    icon: CONCEPT_ICONS.sessions,
    menuId: 'session.board',
    home: 'column',
    aliases: ['Sessions', 'Back to board'],
    shortcutId: 'session.board',
  },
  {
    id: 'inbox',
    label: NAMES.tasks,
    icon: CONCEPT_ICONS.inbox,
    menuId: 'menu.tasks',
    home: 'column',
    aliases: formerNamesOf(NAMES.tasks),
  },
  {
    id: 'workflows',
    label: NAMES.workflows,
    icon: CONCEPT_ICONS.workflows,
    menuId: 'menu.workflows',
    home: 'column',
    aliases: [],
  },
  {
    id: 'chat',
    label: NAMES.chat,
    icon: CONCEPT_ICONS.chat,
    menuId: 'menu.chat',
    home: 'column',
    aliases: [],
  },
  {
    id: 'impact',
    label: NAMES.impact,
    icon: CONCEPT_ICONS.impact,
    menuId: 'menu.impact',
    home: 'column',
    aliases: [],
    isReference: true,
  },
  {
    id: 'terminal',
    label: NAMES.terminal,
    icon: CONCEPT_ICONS.terminal,
    menuId: 'terminal.studio',
    home: 'tile',
    aliases: ['Go to Terminal', 'Terminals'],
    shortcutId: 'terminal.studio',
  },
  {
    id: 'browser',
    label: NAMES.browser,
    icon: CONCEPT_ICONS.browser,
    menuId: 'menu.browser',
    home: 'tile',
    aliases: ['Go to Browser'],
  },
  {
    id: 'monitoring',
    label: NAMES.monitoring,
    icon: CONCEPT_ICONS.monitoring,
    menuId: 'menu.monitoring',
    home: 'tile',
    aliases: ['Go to Monitoring', 'Ports'],
  },
  {
    id: 'notifications',
    label: NAMES.notifications,
    icon: CONCEPT_ICONS.notifications,
    menuId: 'menu.notifications',
    home: 'topBar',
    aliases: [],
  },
];
