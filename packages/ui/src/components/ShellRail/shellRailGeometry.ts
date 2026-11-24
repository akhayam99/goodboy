import { SHELL_GUTTER_PX } from '../../frameGeometry';
import { ICON_BUTTON_SIZE_CLASSES } from '../IconButton';
import type { ShellRailForm } from './shellRailFormContext';

export const SHELL_RAIL_EDGE_PX = 4;

export const SHELL_RAIL_FOOT_PX = SHELL_GUTTER_PX;

export const SHELL_RAIL_TILE = ICON_BUTTON_SIZE_CLASSES.md;

export const SHELL_RAIL_WIDTH_PX = {
  wide: 64,
  narrow: 44,
} as const satisfies Record<ShellRailForm, number>;

export const TOOL_RAIL_WIDTH_PX = {
  wide: 56,
  narrow: 44,
} as const satisfies Record<ShellRailForm, number>;

export const SHELL_RAIL_NARROW_BELOW_PX = 1100;
