import { NAMES } from '../../../../shared/utils/names';
import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import type { ClusterPane } from '../../panes/clusterPane';

export type SessionTool = {
  readonly pane: ClusterPane;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly fullLabel?: string;
  readonly shortcut?: ShortcutId;
};

export const RAIL_TOOLS: ReadonlyArray<SessionTool> = [
  {
    pane: 'terminal',
    icon: CONCEPT_ICONS.terminal,
    label: NAMES.terminal,
    shortcut: 'terminal.studio',
  },
  {
    pane: 'browser',
    icon: CONCEPT_ICONS.browser,
    label: NAMES.browser,
    shortcut: 'browser.address',
  },
];
