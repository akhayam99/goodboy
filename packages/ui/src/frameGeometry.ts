export const FRAME_BAND_PX = 40;

export const FRAME_TITLE_ROW_PX = 32;

export const FRAME_TITLE_CENTRE_PX = FRAME_BAND_PX + FRAME_TITLE_ROW_PX / 2;

export const FRAME_PAGES = [
  'board',
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
] as const;

export type FramePage = (typeof FRAME_PAGES)[number];

export type FrameTitleLeft = 'column' | 'gutter';

export type FrameGeometry = {
  readonly bandHeight: number;
  readonly titleRowHeight: number;
  readonly titleCentreY: number;
  readonly titleLeft: FrameTitleLeft;
};

export const frameGeometryOf = ({ page }: { readonly page: FramePage }): FrameGeometry => ({
  bandHeight: FRAME_BAND_PX,
  titleRowHeight: FRAME_TITLE_ROW_PX,
  titleCentreY: FRAME_TITLE_CENTRE_PX,
  titleLeft: page === 'chat' ? 'gutter' : 'column',
});
