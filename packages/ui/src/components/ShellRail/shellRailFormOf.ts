import type { ShellRailForm } from './shellRailFormContext';
import { SHELL_RAIL_NARROW_BELOW_PX } from './shellRailGeometry';

type Params = {
  readonly windowWidth: number;
};

export const shellRailFormOf = ({ windowWidth }: Params): ShellRailForm =>
  windowWidth < SHELL_RAIL_NARROW_BELOW_PX ? 'narrow' : 'wide';
