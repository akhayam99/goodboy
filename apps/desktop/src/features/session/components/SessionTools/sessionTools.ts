import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import type { ClusterPane } from '../../panes/clusterPane';

type SessionToolGroup = 'read' | 'work' | 'tools';

export type SessionTool = {
  readonly pane: ClusterPane;
  readonly group: SessionToolGroup;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shortcut: ShortcutId;
};

export const SESSION_TOOLS: ReadonlyArray<SessionTool> = [
  {
    pane: 'explore',
    group: 'read',
    icon: CONCEPT_ICONS.explore,
    label: 'Explore',
    shortcut: 'lens.explore',
  },
  {
    pane: 'context',
    group: 'read',
    icon: CONCEPT_ICONS.context,
    label: 'Context',
    shortcut: 'lens.context',
  },
  {
    pane: 'ask',
    group: 'work',
    icon: CONCEPT_ICONS.chat,
    label: 'Ask',
    shortcut: 'ask.open',
  },
  {
    pane: 'spawned',
    group: 'work',
    icon: CONCEPT_ICONS.agents,
    label: 'Agents',
    shortcut: 'session.spawned',
  },
  {
    pane: 'scripts',
    group: 'work',
    icon: CONCEPT_ICONS.scripts,
    label: 'Scripts',
    shortcut: 'lens.scripts',
  },
  {
    pane: 'terminal',
    group: 'tools',
    icon: CONCEPT_ICONS.terminal,
    label: 'Terminal',
    shortcut: 'session.terminal',
  },
];
