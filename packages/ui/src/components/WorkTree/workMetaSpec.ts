export const WORK_ROW = {
  container: '@container',
  chipLabel: '@max-[520px]:sr-only',
  kindChip: '@max-[520px]:w-auto',
  title: 'min-w-16',
  state: '@max-[320px]:hidden',
  stateSlot:
    'flex w-28 shrink-0 items-center justify-end whitespace-nowrap @max-[790px]:w-24 @max-[320px]:hidden',
  hint: 'hidden @min-[640px]:group-hover:inline @min-[640px]:group-focus-within:inline',
} as const satisfies Record<string, string>;

export const WORK_META_COLUMN = {
  routing:
    'flex w-34 shrink-0 items-center justify-end gap-1 overflow-hidden @max-[440px]:w-3 @max-[360px]:hidden',
  routingName: 'min-w-0 truncate @max-[440px]:sr-only',
  routingDetail: 'flex shrink-0 items-center gap-1 @max-[720px]:sr-only',
  time: 'w-20 shrink-0 truncate text-right @max-[360px]:hidden',
  timeSuffix: '@max-[640px]:sr-only',
  cost: 'w-12 shrink-0 truncate text-right @max-[560px]:hidden',
  costRange: 'w-18 shrink-0 truncate text-right @max-[560px]:hidden',
  action: 'flex min-w-19 shrink-0 items-center justify-end',
  menu: 'flex w-6 shrink-0 items-center justify-end',
} as const satisfies Record<string, string>;
