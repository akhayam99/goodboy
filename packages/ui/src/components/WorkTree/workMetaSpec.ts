export const WORK_ROW = {
  container: '@container',
  stateFull: '@max-[880px]:hidden',
  stateShort: '@min-[880px]:hidden',
  chipLabel: '@max-[520px]:sr-only',
  chipBox: 'min-w-24 @max-[520px]:min-w-0',
  kindChip: '@max-[520px]:w-auto',
  hint: 'hidden @min-[640px]:group-hover:inline @min-[640px]:group-focus-within:inline',
} as const satisfies Record<string, string>;

export const WORK_META_COLUMN = {
  model: 'flex w-24 shrink-0 items-center gap-1 overflow-hidden @max-[640px]:w-3',
  modelLabel: 'min-w-0 truncate @max-[640px]:sr-only',
  effort: 'w-13 shrink-0 truncate @max-[760px]:sr-only',
  time: 'w-24 shrink-0 truncate text-right @max-[640px]:w-20',
  cost: 'w-14 shrink-0 truncate text-right',
  costRange: 'w-18 shrink-0 truncate text-right',
  stepCost: '@max-[520px]:hidden',
  action: 'flex min-w-19 shrink-0 items-center justify-end',
  menu: 'flex w-6 shrink-0 items-center justify-end',
} as const satisfies Record<string, string>;
