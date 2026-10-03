import type { StepSize, WorkflowTaskDifficulty } from '@goodboy/types';

const SIZE_BY_DIFFICULTY: Readonly<Record<WorkflowTaskDifficulty, StepSize | null>> = {
  light: 'small',
  standard: 'medium',
  heavy: 'large',
  unknown: null,
};

export const stepSizeForDifficulty = (difficulty: WorkflowTaskDifficulty): StepSize | null =>
  SIZE_BY_DIFFICULTY[difficulty];
