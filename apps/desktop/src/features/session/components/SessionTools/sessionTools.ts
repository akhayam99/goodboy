import { NAMES } from '../../../../shared/utils/names';
import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import type { ClusterPane } from '../../panes/clusterPane';

type ToolGroup = 'session' | 'workspace';

export type SessionTool = {
  readonly pane: ClusterPane;
  readonly group: ToolGroup;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly fullLabel?: string;
  readonly shortcut?: ShortcutId;
};

export const SESSION_TOOLS: ReadonlyArray<SessionTool> = [
  {
    pane: 'explore',
    group: 'session',
    icon: CONCEPT_ICONS.explore,
    label: 'Explore',
    shortcut: 'lens.explore',
  },
  {
    pane: 'spawned',
    group: 'session',
    icon: CONCEPT_ICONS.agents,
    label: 'Agents',
    shortcut: 'session.spawned',
  },
  {
    pane: 'scripts',
    group: 'session',
    icon: CONCEPT_ICONS.scripts,
    label: 'Scripts',
    shortcut: 'lens.scripts',
  },
];

export const WORKSPACE_TOOLS: ReadonlyArray<SessionTool> = [
  {
    pane: 'terminal',
    group: 'workspace',
    icon: CONCEPT_ICONS.terminal,
    label: NAMES.terminal,
    shortcut: 'terminal.studio',
  },
  {
    pane: 'browser',
    group: 'workspace',
    icon: CONCEPT_ICONS.browser,
    label: NAMES.browser,
    shortcut: 'browser.address',
  },
];
