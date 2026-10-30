import type { ComponentType } from 'react';
import { NextStepScene } from './NextStepScene';

export const U31_NEXT_STEP_SCENES = {
  'u31-next-step': () => <NextStepScene />,
} satisfies Readonly<Record<string, ComponentType>>;
