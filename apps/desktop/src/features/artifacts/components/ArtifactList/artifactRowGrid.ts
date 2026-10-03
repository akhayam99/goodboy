export const ARTIFACT_ROW_GRID = {
  frame: 'flex min-h-9 min-w-0 items-center gap-2.5 pr-1.5 pl-0.5',
  lead: 'size-[18px] shrink-0',
  glyph: 'w-5 shrink-0',
  title: 'min-w-16 flex-1 truncate text-row',
  state:
    'flex w-52 min-w-0 shrink-0 items-center justify-start @max-[560px]:w-32 @max-[400px]:hidden',
  date: 'w-[72px] shrink-0 text-right text-secondary tabular-nums text-faint-foreground @max-[480px]:hidden',
  tail: 'flex w-60 shrink-0 items-center @max-[560px]:w-39',
  primary: 'flex w-[92px] shrink-0 items-center justify-end',
  hover:
    'pointer-events-none flex w-[84px] shrink-0 items-center justify-end opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 @max-[560px]:hidden',
  remove: 'flex w-8 shrink-0 items-center justify-center',
  menu: 'flex w-8 shrink-0 items-center justify-center',
  deletedTail: 'flex w-60 shrink-0 items-center',
  deleted: 'flex w-[148px] shrink-0 items-center justify-end',
  partsIndent: 'pl-[60px]',
} as const satisfies Record<string, string>;
