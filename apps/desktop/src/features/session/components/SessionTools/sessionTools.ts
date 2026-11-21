import { NAMES } from '../../../../shared/utils/names';
import type { IconGlyph } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import type { ClusterPane } from '../../panes/clusterPane';

export type RailToolId = ClusterPane | 'ask';

export type SessionTool = {
  readonly pane: RailToolId;
  readonly icon: IconGlyph;
  readonly label: string;
  readonly fullLabel?: string;
  readonly shortcut?: ShortcutId;
  readonly isSessionOnly: boolean;
};

export const RAIL_TOOLS: ReadonlyArray<SessionTool> = [
  {
    pane: 'terminal',
    icon: CONCEPT_ICONS.terminal,
    label: NAMES.terminal,
    shortcut: 'terminal.studio',
    isSessionOnly: false,
  },
  {
    pane: 'browser',
    icon: CONCEPT_ICONS.browser,
    label: NAMES.browser,
    shortcut: 'browser.address',
    isSessionOnly: false,
  },
  {
    pane: 'scripts',
    icon: CONCEPT_ICONS.scripts,
    label: NAMES.scripts,
    isSessionOnly: true,
  },
  {
    pane: 'ask',
    icon: CONCEPT_ICONS.ask,
    label: 'Ask',
    shortcut: 'ask.open',
    isSessionOnly: true,
  },
  {
    pane: 'monitoring',
    icon: CONCEPT_ICONS.monitoring,
    label: NAMES.monitor,
    fullLabel: NAMES.monitoring,
    isSessionOnly: false,
  },
];
