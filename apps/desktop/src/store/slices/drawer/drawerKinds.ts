import type { DrawerSizing } from '@goodboy/ui';
import type { ClusterPane } from '../../../features/session/panes/clusterPane';
import type { DrawerContent } from './state';

export type DrawerSurface = 'tool' | 'item' | 'reader' | 'form';

export type DrawerKindRow = {
  readonly surface: DrawerSurface;
  readonly sizing: DrawerSizing;
  readonly pane: ClusterPane | null;
  readonly openerPane: ClusterPane | null;
};

export type DrawerKind = DrawerContent['kind'];

const TOOL = { surface: 'tool', sizing: 'side', openerPane: null } as const;

const READER = { surface: 'reader', sizing: 'side', pane: null, openerPane: null } as const;

const WIDE_READER = { ...READER, sizing: 'reader' } as const;

export const DRAWER_KINDS = {
  scripts: { ...TOOL, pane: 'scripts' },
  terminal: { ...TOOL, pane: 'terminal' },
  browser: { ...TOOL, sizing: 'browser', pane: 'browser' },
  'explore-file': WIDE_READER,
  scriptRun: { ...READER, surface: 'tool', openerPane: 'scripts' },
  ask: READER,
  question: { ...READER, surface: 'item', openerPane: null },
  new: { ...WIDE_READER, surface: 'form' },
  'fix-comments': { ...READER, surface: 'form' },
  artifact: READER,
  'artifact-document': WIDE_READER,
  'plan-part': READER,
  'check-analysis': READER,
  conversation: READER,
  transcript: READER,
  'history-versions': READER,
  'file-diff': WIDE_READER,
  'identifier-peek': WIDE_READER,
  'lead-details': READER,
} as const satisfies Record<DrawerKind, DrawerKindRow>;
