export const ARTIFACT_ROW_GRID = {
  frame: 'flex min-h-9 min-w-0 items-center gap-3 pr-2 pl-0.5',
  lead: 'size-[18px] shrink-0',
  glyph: 'w-5 shrink-0',
  title: 'min-w-16 flex-1 truncate text-row',
  state:
    'flex w-36 min-w-0 shrink-0 items-center justify-start @max-[560px]:w-32 @max-[400px]:hidden',
  date: 'w-[72px] shrink-0 text-right text-meta tabular-nums text-faint-foreground @max-[480px]:hidden',
  action: 'flex w-[92px] shrink-0 items-center justify-end',
  partsIndent: 'pl-[60px]',
} as const satisfies Record<string, string>;
