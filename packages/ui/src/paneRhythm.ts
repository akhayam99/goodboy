export const PANE_RHYTHM = {
  inset: 'px-6',
  header: 'px-6 py-4',
  body: 'px-6 py-5',
  dock: 'px-6 py-4',
  stack: 'flex flex-col gap-5',
  column: 'mx-auto w-full',
  measure: {
    reading: 'max-w-3xl',
    pane: 'max-w-5xl',
    full: 'max-w-none',
    chat: 'max-w-[880px]',
    hero: 'max-w-[640px]',
  },
  rail: {
    header: 'px-3 py-2.5',
    body: 'px-3 py-3',
    dock: 'px-3 py-2.5',
  },
  navRail: {
    inset: 'px-2',
    body: 'px-2 py-3',
    row: 'px-2 py-1.5',
  },
  board: {
    pad: 'p-5',
    colGap: 'gap-3',
    colWidth: 'w-[17rem] min-w-[15rem]',
    cardGap: 'gap-2',
    colStack: 'gap-3',
  },
  sessionList: {
    pad: 'px-2 py-2',
    cardGap: 'gap-2',
  },
} as const;
