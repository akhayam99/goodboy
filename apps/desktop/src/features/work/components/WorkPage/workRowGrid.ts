export const WORK_ROW_GRID = {
  frame:
    'grid min-h-14 min-w-0 grid-cols-[1rem_minmax(0,1fr)_minmax(9rem,13rem)_6rem_5.5rem_4.5rem_3rem] items-center gap-3 px-2 py-2',
  state: 'min-w-0 truncate text-ui',
  action: 'flex min-w-0 items-center justify-end',
  number: 'text-right text-ui tabular-nums text-muted-foreground',
} as const satisfies Record<string, string>;
