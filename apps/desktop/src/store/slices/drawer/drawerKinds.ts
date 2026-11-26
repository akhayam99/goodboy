import type { DrawerSizing } from '@goodboy/ui';
import type { ClusterPane } from '../../../features/session/panes/clusterPane';
import type { DrawerContent } from './state';

export type DrawerSurface = 'tool' | 'item' | 'reader' | 'form';

export type DrawerPlace = 'column' | 'row';

export type DrawerKindRow = {
  readonly surface: DrawerSurface;
  readonly sizing: DrawerSizing;
  readonly place: DrawerPlace;
  readonly rowMin: number;
  readonly pane: ClusterPane | null;
  readonly openerPane: ClusterPane | null;
};

export type DrawerKind = DrawerContent['kind'];

const ROW_MIN_PX = 180;

const TOOL = {
  surface: 'tool',
  sizing: 'side',
  place: 'row',
  rowMin: ROW_MIN_PX,
  openerPane: null,
} as const;

const READER = {
  surface: 'reader',
  sizing: 'side',
  place: 'row',
  rowMin: ROW_MIN_PX,
  pane: null,
  openerPane: null,
} as const;

const WIDE_READER = { ...READER, sizing: 'reader' } as const;

export const DRAWER_KINDS = {
  scripts: { ...TOOL, pane: 'scripts' },
  terminal: { ...TOOL, place: 'column', rowMin: 200, pane: 'terminal' },
  browser: { ...TOOL, sizing: 'browser', place: 'column', rowMin: 240, pane: 'browser' },
  monitoring: { ...TOOL, pane: 'monitoring' },
  'explore-file': WIDE_READER,
  scriptRun: { ...READER, surface: 'tool', openerPane: 'scripts' },
  question: { ...READER, surface: 'item', openerPane: null },
  new: { ...WIDE_READER, surface: 'form' },
  'fix-comments': { ...READER, surface: 'form' },
  artifact: READER,
  'artifact-document': WIDE_READER,
  'plan-part': READER,
  'check-analysis': READER,
  conversation: READER,
  transcript: READER,
  'pull-request': READER,
  'history-versions': READER,
  'file-diff': WIDE_READER,
  'identifier-peek': WIDE_READER,
  'lead-details': READER,
} as const satisfies Record<DrawerKind, DrawerKindRow>;
