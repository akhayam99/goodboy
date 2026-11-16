export const ROLE_GRID = {
  row: 'grid w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,12rem)_4.5rem_5rem] items-center gap-x-3 text-left @[720px]:grid-cols-[9rem_minmax(0,1fr)_12rem_4.5rem_5rem]',
  name: 'min-w-0 truncate text-eyebrow text-foreground',
  job: 'hidden min-w-0 truncate text-meta @[720px]:block',
  route: 'col-span-2 min-w-0',
  source: 'flex min-w-0 items-center gap-1',
} as const;
