export const WORK_ROW = {
  container: '@container',
  kindChip: '@max-[520px]:w-auto',
  title: 'min-w-16',
  label: 'min-w-40 @max-[440px]:min-w-0',
  state: '@max-[320px]:hidden',
  stateSlot:
    'flex min-w-28 max-w-64 shrink-0 items-center justify-end whitespace-nowrap @max-[790px]:min-w-24 @max-[320px]:hidden',
} as const satisfies Record<string, string>;

export const WORK_META_COLUMN = {
  routing:
    'flex w-34 shrink-0 items-center justify-end gap-1 overflow-hidden @max-[840px]:w-auto @max-[360px]:hidden',
  routingName: 'min-w-0 truncate @max-[840px]:sr-only',
  routingDetail: 'flex shrink-0 items-center gap-1 @max-[840px]:sr-only',
  time: 'w-20 shrink-0 truncate text-right @max-[500px]:hidden',
  timeSuffix: '@max-[640px]:sr-only',
  cost: 'w-12 shrink-0 truncate text-right @max-[620px]:hidden',
  costRange: 'w-18 shrink-0 truncate text-right @max-[620px]:hidden',
  model: 'flex w-38 shrink-0 items-center justify-end gap-2 overflow-hidden @max-[640px]:w-auto',
  modelName: 'min-w-0 truncate @max-[640px]:sr-only',
  stack: 'flex w-18 shrink-0 flex-col items-end justify-center @max-[500px]:hidden',
  stackTime: 'max-w-full truncate text-meta tabular-nums text-muted-foreground',
  stackCost: 'max-w-full truncate text-chip tabular-nums text-faint-foreground @max-[620px]:hidden',
  action: 'flex min-w-19 shrink-0 items-center justify-end',
  menu: 'flex w-6 shrink-0 items-center justify-end',
} as const satisfies Record<string, string>;
