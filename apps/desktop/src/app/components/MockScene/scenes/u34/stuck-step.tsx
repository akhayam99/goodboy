import type { ComponentType } from 'react';
import { StuckStepScene } from './StuckStepScene';

export const U34_STUCK_STEP_SCENES: Readonly<Record<string, ComponentType>> = {
  'u34-p25-not-finished': () => <StuckStepScene state="not-finished" />,
  'u34-p25-blocked': () => <StuckStepScene state="blocked" />,
  'u34-p25-finished': () => <StuckStepScene state="finished" />,
};
