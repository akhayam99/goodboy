export const FRAME_BAND_PX = 40;

export const FRAME_TITLE_ROW_PX = 32;

export const FRAME_TITLE_CENTRE_PX = FRAME_BAND_PX + FRAME_TITLE_ROW_PX / 2;

export const FRAME_DRAWER_ROW_PX = 28;

export const FRAME_DRAWER_INSET_PX = (FRAME_BAND_PX - FRAME_DRAWER_ROW_PX) / 2;

export const FRAME_PAGES = [
  'board',
  'terminal',
  'overview',
  'branch',
  'runs',
  'run',
  'agents',
  'agent',
  'questions',
  'inbox',
  'workflows',
  'impact',
  'guide',
  'whatsNew',
  'notifications',
  'settings',
  'chat',
  'scripts',
  'artifacts',
  'explore',
  'storage',
  'monitoring',
  'plan',
  'report',
  'wireframe',
  'release',
  'guideChapter',
] as const;

export type FramePage = (typeof FRAME_PAGES)[number];

export const FRAME_TYPES = ['column', 'reader', 'stage', 'split'] as const;

export type FrameType = (typeof FRAME_TYPES)[number];

export const PAGE_FRAME: Readonly<Record<FramePage, FrameType>> = {
  overview: 'column',
  runs: 'column',
  run: 'column',
  agents: 'column',
  agent: 'column',
  questions: 'column',
  workflows: 'column',
  impact: 'column',
  settings: 'column',
  scripts: 'column',
  artifacts: 'column',
  explore: 'column',
  storage: 'column',
  monitoring: 'column',
  plan: 'reader',
  report: 'reader',
  wireframe: 'reader',
  release: 'reader',
  guideChapter: 'reader',
  board: 'stage',
  terminal: 'stage',
  chat: 'split',
  branch: 'split',
  guide: 'split',
  whatsNew: 'split',
  inbox: 'split',
  notifications: 'split',
};

export type FrameTitleLeft = 'column' | 'stage' | 'detail';

export type FrameTier = 'column' | 'full';

const TITLE_LEFT_OF: Readonly<Record<FrameType, FrameTitleLeft>> = {
  column: 'column',
  reader: 'column',
  stage: 'stage',
  split: 'detail',
};

const TIER_OF: Readonly<Record<FrameType, FrameTier>> = {
  column: 'column',
  reader: 'column',
  stage: 'full',
  split: 'column',
};

type FrameTypeParams = {
  readonly type: FrameType;
};

export const frameTierOf = ({ type }: FrameTypeParams): FrameTier => TIER_OF[type];

export type FrameGeometry = {
  readonly type: FrameType;
  readonly bandHeight: number;
  readonly titleRowHeight: number;
  readonly titleCentreY: number;
  readonly drawerRowHeight: number;
  readonly titleLeft: FrameTitleLeft;
};

type FramePageParams = {
  readonly page: FramePage;
};

export const FRAME_PAGE_HEADER_INSET_PX = 12;

const SESSION_PAGES: ReadonlySet<FramePage> = new Set<FramePage>([
  'overview',
  'branch',
  'runs',
  'run',
  'agents',
  'agent',
  'questions',
  'scripts',
  'artifacts',
  'explore',
  'plan',
  'report',
  'wireframe',
]);

export const frameGeometryOf = ({ page }: FramePageParams): FrameGeometry => {
  const type = PAGE_FRAME[page];
  const bandHeight = SESSION_PAGES.has(page) ? FRAME_PAGE_HEADER_INSET_PX : FRAME_BAND_PX;
  return {
    type,
    bandHeight,
    titleRowHeight: FRAME_TITLE_ROW_PX,
    titleCentreY: bandHeight + FRAME_TITLE_ROW_PX / 2,
    drawerRowHeight: FRAME_DRAWER_ROW_PX,
    titleLeft: TITLE_LEFT_OF[type],
  };
};
