export const PANE_RHYTHM = {
  inset: 'px-6',
  header: 'px-6 py-5',
  body: 'px-6 py-5',
  dock: 'px-6 py-4',
  stack: 'flex flex-col gap-5',
  column: 'mx-auto w-full max-w-[var(--column-max)]',
  hero: 'max-w-[640px]',
  detail: {
    band: 'px-6 py-2',
    body: 'px-6 py-4',
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
    nest: 'pl-6',
  },
  board: {
    pad: 'px-6 py-5',
    colGap: 'gap-3',
    colWidth: 'w-72 shrink-0',
    dock: 'w-11',
    dockOpen: 'w-34',
    dockSticky: 'sticky right-0 bg-background',
    maxWidth: 'max-w-[106rem]',
    cardGap: 'gap-2.5',
    colStack: 'gap-2.5',
  },
  sessionList: {
    pad: 'px-2 py-2',
    cardGap: 'gap-2',
  },
} as const;
