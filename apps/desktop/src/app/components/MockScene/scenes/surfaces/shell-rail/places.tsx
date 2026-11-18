import type { ComponentType } from 'react';
import { ShellRailScene } from './ShellRailScene';

export const SHELL_RAIL_PLACES_SCENES = {
  'shell-rail': () => <ShellRailScene />,
} satisfies Readonly<Record<string, ComponentType>>;
