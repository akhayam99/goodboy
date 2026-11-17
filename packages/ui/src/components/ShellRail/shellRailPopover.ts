import type { DropdownAlign, DropdownSide } from '../../useDropdownDirection';

type ShellRailPopoverPlace = {
  readonly side: DropdownSide;
  readonly align: DropdownAlign;
};

export const SHELL_RAIL_POPOVER = {
  side: 'right',
  align: 'start',
} as const satisfies ShellRailPopoverPlace;
