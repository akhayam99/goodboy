export const BOARD_LANE_MIN_REM = 13;

export const BOARD_LANE_GAP_REM = 0.75;

export const PANE_RHYTHM = {
  inset: 'px-6',
  header: 'px-6 py-5',
  body: 'px-6 py-5',
  dock: 'px-6 py-4',
  stack: 'flex flex-col gap-5',
  below: {
    title: 'pb-4',
    section: 'pb-5',
  },
  prose: 'max-w-[var(--measure)]',
  proseBlocks: [
    '[&>div>p]:max-w-[var(--measure)]',
    '[&>div>ul]:max-w-[var(--measure)]',
    '[&>div>ol]:max-w-[var(--measure)]',
    '[&>div>blockquote]:max-w-[var(--measure)]',
    '[&>div>h1]:max-w-[var(--measure)]',
    '[&>div>h2]:max-w-[var(--measure)]',
    '[&>div>h3]:max-w-[var(--measure)]',
    '[&>div>h4]:max-w-[var(--measure)]',
  ].join(' '),
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
  },
  board: {
    pad: 'px-6 py-5',
    laneGap: 'gap-3',
    maxWidth: 'max-w-[123.75rem]',
    lanesSix: 'grid-cols-[repeat(6,minmax(13rem,20rem))]',
    lanesFive: 'grid-cols-[repeat(5,minmax(13rem,20rem))]',
    lanesScroll: 'w-max grid-cols-[repeat(5,13rem)]',
    laneStack: 'gap-3',
    halves: 'gap-5',
    cardGap: 'gap-3',
  },
  sessionList: {
    pad: 'px-2 py-2',
    cardGap: 'gap-2',
  },
} as const;
