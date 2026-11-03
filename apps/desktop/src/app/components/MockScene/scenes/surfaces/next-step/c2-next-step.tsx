import type { ComponentType } from 'react';
import { C2NextStepScene } from './C2NextStepScene';

export const U29_C2_NEXT_STEP_SCENES = {
  'c2-next-step': () => <C2NextStepScene />,
} satisfies Readonly<Record<string, ComponentType>>;
