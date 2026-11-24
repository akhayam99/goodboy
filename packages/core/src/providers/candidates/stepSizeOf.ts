import type { StepSize, WorkflowTaskDifficulty } from '@goodboy/types';

const SIZE_OF_DIFFICULTY: Readonly<Record<WorkflowTaskDifficulty, StepSize | null>> = {
  light: 'small',
  standard: 'medium',
  heavy: 'large',
  unknown: null,
};

type Params = {
  readonly difficulty: WorkflowTaskDifficulty | null | undefined;
};

export const stepSizeOf = ({ difficulty }: Params): StepSize | null =>
  difficulty == null ? null : SIZE_OF_DIFFICULTY[difficulty];
