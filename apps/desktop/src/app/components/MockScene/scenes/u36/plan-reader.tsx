import type { ComponentType } from 'react';
import { ArtifactPlanCommentsScene } from '../ArtifactPlanCommentsScene';

export const U36_PLAN_READER_SCENES: Readonly<Record<string, ComponentType>> = {
  'u36-plan-ran': () => <ArtifactPlanCommentsScene hasRun />,
};
