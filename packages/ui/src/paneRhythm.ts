export const BOARD_LANE_MIN_REM = 13;

export const BOARD_LANE_GAP_REM = 0.75;

export const PANE_RHYTHM = {
  inset: 'px-6',
  header: 'px-6 py-5',
  body: 'px-6 py-5',
  dock: 'px-6 py-4',
  stack: 'flex flex-col gap-6',
  below: {
    title: 'pb-4',
    section: 'pb-6',
  },
  prose: 'max-w-[var(--measure)]',
  message: {
    user: 'max-w-[calc(100%-3rem)]',
  },
  hero: 'max-w-[640px]',
  detail: {
    band: 'px-6 py-2',
    body: 'px-6 py-4',
  },
  rail: {
    header: 'px-3 py-3',
    body: 'px-3 py-3',
    dock: 'px-3 py-3',
  },
  navRail: {
    inset: 'px-2',
    body: 'px-2 py-3',
    row: 'px-2 min-h-8',
    rowTwo: 'px-2 py-1 min-h-12',
    nest: 'pl-6',
    door: 'h-7 px-2',
    doorGap: 'gap-1',
  },
  property: {
    group: 'flex flex-col gap-1',
    grid: 'grid grid-cols-[88px_minmax(0,1fr)] items-start gap-x-2 gap-y-1',
    label: 'flex h-7 items-center pl-2',
    value: 'flex min-h-7 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-2',
    groupGap: 'gap-6',
  },
  tree: {
    row: 'min-h-12',
    line: 'h-7',
    meta: 'h-5',
  },
  board: {
    pad: 'px-6 pb-5',
    laneGap: 'gap-3',
    maxWidth: 'max-w-[123.75rem]',
    lanesSix: 'grid-cols-[repeat(6,minmax(13rem,20rem))]',
    lanesFive: 'grid-cols-[repeat(5,minmax(13rem,20rem))]',
    lanesScroll: 'w-max grid-cols-[repeat(5,13rem)]',
    laneStack: 'gap-3',
    halves: 'gap-4',
    cardGap: 'gap-3',
  },
  sessionList: {
    pad: 'px-2 pb-2',
    cardGap: 'gap-2',
    rowInset: 'px-2',
    headerInset: 'pl-4 pr-2',
    rowGap: 'gap-1',
    listGap: 'gap-1',
    menuTrigger: 'size-7',
  },
} as const;
