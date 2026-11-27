import type { IconGlyph } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../components/conceptIcons';
import type { ShortcutId } from '../keyboard/registry';
import { NAMES, formerNamesOf } from '../utils/names';

export type FootDestinationId = 'settings' | 'guide' | 'whatsNew';

export type DestinationId =
  | 'home'
  | 'board'
  | 'inbox'
  | 'workflows'
  | 'chat'
  | 'connections'
  | 'impact'
  | 'terminal'
  | 'browser'
  | 'monitoring'
  | 'notifications'
  | FootDestinationId;

export type RailDestinationId = 'terminal' | 'browser';

export type StudioDestinationId = Exclude<DestinationId, 'home' | 'board'>;

export type PageDestinationId = Exclude<StudioDestinationId, RailDestinationId>;

export type DestinationHome = 'column' | 'rail' | 'menu' | 'topBar' | 'foot';

export type DestinationScope = 'app' | 'workspace' | 'session';

export type Destination = {
  readonly id: DestinationId;
  readonly label: string;
  readonly icon: IconGlyph;
  readonly menuId?: string;
  readonly home: DestinationHome;
  readonly scope: DestinationScope;
  readonly aliases: ReadonlyArray<string>;
  readonly shortcutId?: ShortcutId;
  readonly isReference?: boolean;
  readonly railWord?: string;
};

export const DESTINATIONS: ReadonlyArray<Destination> = [
  {
    id: 'home',
    label: NAMES.home,
    icon: CONCEPT_ICONS.home,
    home: 'column',
    scope: 'workspace',
    aliases: ['Go to Home', 'Dashboard'],
  },
  {
    id: 'board',
    label: NAMES.board,
    icon: CONCEPT_ICONS.board,
    menuId: 'session.board',
    home: 'column',
    scope: 'workspace',
    aliases: ['Sessions', 'Back to board'],
    shortcutId: 'session.board',
  },
  {
    id: 'inbox',
    label: NAMES.tasks,
    icon: CONCEPT_ICONS.inbox,
    menuId: 'menu.tasks',
    home: 'column',
    scope: 'workspace',
    aliases: formerNamesOf(NAMES.tasks),
  },
  {
    id: 'workflows',
    label: NAMES.workflows,
    icon: CONCEPT_ICONS.workflows,
    menuId: 'menu.workflows',
    home: 'column',
    scope: 'workspace',
    aliases: [],
  },
  {
    id: 'chat',
    label: NAMES.chat,
    icon: CONCEPT_ICONS.chat,
    menuId: 'menu.chat',
    home: 'column',
    scope: 'workspace',
    aliases: [],
  },
  {
    id: 'connections',
    label: NAMES.connections,
    icon: CONCEPT_ICONS.connections,
    menuId: 'menu.connections',
    home: 'column',
    scope: 'workspace',
    aliases: [NAMES.providers, 'Integrations'],
    railWord: 'Connect',
  },
  {
    id: 'impact',
    label: NAMES.impact,
    icon: CONCEPT_ICONS.impact,
    menuId: 'menu.impact',
    home: 'column',
    scope: 'workspace',
    aliases: [],
    isReference: true,
  },
  {
    id: 'monitoring',
    label: NAMES.monitoring,
    icon: CONCEPT_ICONS.monitoring,
    menuId: 'menu.monitoring',
    home: 'menu',
    scope: 'workspace',
    aliases: ['Go to Monitoring', 'Ports'],
    isReference: true,
  },
  {
    id: 'notifications',
    label: NAMES.notifications,
    icon: CONCEPT_ICONS.notifications,
    menuId: 'menu.notifications',
    home: 'topBar',
    scope: 'workspace',
    aliases: [],
  },
  {
    id: 'terminal',
    label: NAMES.terminal,
    icon: CONCEPT_ICONS.terminal,
    menuId: 'terminal.studio',
    home: 'rail',
    scope: 'workspace',
    aliases: ['Go to Terminal', 'Terminals', 'Show or hide Terminal'],
    shortcutId: 'terminal.studio',
  },
  {
    id: 'browser',
    label: NAMES.browser,
    icon: CONCEPT_ICONS.browser,
    menuId: 'menu.browser',
    home: 'rail',
    scope: 'workspace',
    aliases: ['Go to Browser'],
  },
  {
    id: 'settings',
    label: NAMES.settings,
    icon: CONCEPT_ICONS.settings,
    menuId: 'settings.open',
    home: 'foot',
    scope: 'app',
    aliases: ['Open settings'],
    shortcutId: 'settings.open',
  },
  {
    id: 'guide',
    label: NAMES.guide,
    icon: CONCEPT_ICONS.guide,
    menuId: 'menu.guide',
    home: 'foot',
    scope: 'app',
    aliases: [],
  },
  {
    id: 'whatsNew',
    label: NAMES.whatsNew,
    icon: CONCEPT_ICONS.changelog,
    menuId: 'menu.whatsNew',
    home: 'foot',
    scope: 'app',
    aliases: formerNamesOf(NAMES.whatsNew),
  },
];
