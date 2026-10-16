import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import type { ClusterPane } from '../../panes/clusterPane';

export type SessionTool = {
  readonly pane: ClusterPane;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tooltip: string;
  readonly shortcut: ShortcutId;
};

export const SESSION_TOOLS: ReadonlyArray<SessionTool> = [
  {
    pane: 'ask',
    icon: CONCEPT_ICONS.chat,
    label: 'Ask',
    tooltip: 'Ask what is happening in this session',
    shortcut: 'ask.open',
  },
  {
    pane: 'terminal',
    icon: CONCEPT_ICONS.terminal,
    label: 'Terminal',
    tooltip: 'Terminal in this session',
    shortcut: 'session.terminal',
  },
  {
    pane: 'explore',
    icon: CONCEPT_ICONS.explore,
    label: 'Explore',
    tooltip: 'Browse the files of this session',
    shortcut: 'lens.explore',
  },
  {
    pane: 'context',
    icon: CONCEPT_ICONS.context,
    label: 'Context',
    tooltip: 'Goal, decisions and summary of this session',
    shortcut: 'lens.context',
  },
  {
    pane: 'scripts',
    icon: CONCEPT_ICONS.scripts,
    label: 'Scripts',
    tooltip: 'Scripts of the projects in this session',
    shortcut: 'lens.scripts',
  },
];
