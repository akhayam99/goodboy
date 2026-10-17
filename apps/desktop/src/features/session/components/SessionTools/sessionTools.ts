import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import type { ClusterPane } from '../../panes/clusterPane';

export type SessionTool = {
  readonly pane: ClusterPane;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shortcut: ShortcutId;
};

export const SESSION_TOOLS: ReadonlyArray<SessionTool> = [
  {
    pane: 'ask',
    icon: CONCEPT_ICONS.chat,
    label: 'Ask',
    shortcut: 'ask.open',
  },
  {
    pane: 'terminal',
    icon: CONCEPT_ICONS.terminal,
    label: 'Terminal',
    shortcut: 'session.terminal',
  },
  {
    pane: 'explore',
    icon: CONCEPT_ICONS.explore,
    label: 'Explore',
    shortcut: 'lens.explore',
  },
  {
    pane: 'context',
    icon: CONCEPT_ICONS.context,
    label: 'Context',
    shortcut: 'lens.context',
  },
  {
    pane: 'scripts',
    icon: CONCEPT_ICONS.scripts,
    label: 'Scripts',
    shortcut: 'lens.scripts',
  },
];
