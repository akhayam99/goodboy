import type { ComponentType } from 'react';
import { StepEndedScene } from './StepEndedScene';

export const U28_STEP_ENDED_SCENES: Readonly<Record<string, ComponentType>> = {
  'u28-step-ended-run': StepEndedScene,
};
