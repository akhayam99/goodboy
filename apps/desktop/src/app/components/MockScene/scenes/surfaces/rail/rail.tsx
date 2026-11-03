import type { ComponentType } from 'react';
import { RailScene } from './RailScene';

export const U31_RAIL_SCENES = {
  'u31-rail': () => <RailScene />,
} satisfies Readonly<Record<string, ComponentType>>;
