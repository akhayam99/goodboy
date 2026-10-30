import type { ComponentType } from 'react';
import { TooltipsStage } from './edges/TooltipsStage';

export const U30_TOOLTIPS_SCENES = {
  'u30-tooltips': TooltipsStage,
} satisfies Readonly<Record<string, ComponentType>>;
