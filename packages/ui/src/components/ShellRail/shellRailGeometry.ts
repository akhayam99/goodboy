import type { ShellRailForm } from './shellRailFormContext';

export const SHELL_RAIL_WIDTH_PX = {
  wide: 64,
  narrow: 44,
} as const satisfies Record<ShellRailForm, number>;

export const SHELL_RAIL_NARROW_BELOW_PX = 1100;
