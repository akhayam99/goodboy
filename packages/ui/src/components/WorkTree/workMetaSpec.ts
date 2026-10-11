export const WORK_ROW = {
  container: '@container',
  pointerLayer: 'pointer-events-auto flex shrink-0 cursor-pointer items-center',
  title: 'min-w-16',
  label: 'min-w-40 @max-[440px]:min-w-0',
  state: '@max-[320px]:hidden',
  stateSlot:
    'flex min-w-28 max-w-64 shrink-0 items-center justify-end whitespace-nowrap @max-[790px]:min-w-24 @max-[320px]:hidden',
} as const satisfies Record<string, string>;

export const WORK_META_COLUMN = {
  time: 'w-20 shrink-0 truncate text-right @max-[500px]:hidden',
  timeSuffix: '@max-[640px]:sr-only',
  cost: 'w-12 shrink-0 truncate text-right @max-[620px]:hidden',
  costRange: 'w-18 shrink-0 truncate text-right @max-[620px]:hidden',
  model: 'flex w-34 shrink-0 items-center justify-start gap-2 overflow-hidden @max-[640px]:w-auto',
  modelGlyph: 'relative h-6 shrink-0',
  modelLines: 'flex min-w-0 flex-1 flex-col @max-[640px]:sr-only',
  modelName: 'block h-4 truncate text-meta',
  modelDetail: 'block h-4 truncate text-chip text-faint-foreground',
  stack: 'flex w-18 shrink-0 flex-col items-end justify-center @max-[500px]:hidden',
  stackTime: 'h-4 max-w-full truncate text-meta tabular-nums text-muted-foreground',
  stackCost:
    'h-4 max-w-full truncate text-chip tabular-nums text-faint-foreground @max-[620px]:hidden',
  action: 'flex w-20 shrink-0 items-center justify-end',
  menu: 'flex w-6 shrink-0 items-center justify-end',
} as const satisfies Record<string, string>;
