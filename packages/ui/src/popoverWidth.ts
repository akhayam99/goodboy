export type PopoverWidth = 'compact' | 'standard' | 'wide' | 'studio';

export const POPOVER_WIDTH_PX = {
  compact: 240,
  standard: 320,
  wide: 384,
  studio: 500,
} as const satisfies Record<PopoverWidth, number>;

export const POPOVER_WIDTH_CLASS = {
  compact: 'w-60',
  standard: 'w-80',
  wide: 'w-96',
  studio: 'w-125',
} as const satisfies Record<PopoverWidth, string>;
