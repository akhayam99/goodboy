import type { HistoryPlanPrediction } from '@goodboy/types';

type Params = {
  readonly prediction: HistoryPlanPrediction | null;
};

export type PredictedConflict = {
  readonly files: ReadonlyArray<string>;
  readonly sha: string | null;
};

export const predictedConflictOf = ({ prediction }: Params): PredictedConflict | null => {
  if (prediction === null || !prediction.isSupported || prediction.head !== null) {
    return null;
  }
  const conflicted = (prediction.steps ?? []).filter((step) => step.outcome === 'conflict');
  return {
    files: [...new Set(conflicted.flatMap((step) => step.files))],
    sha: conflicted[0]?.sha ?? null,
  };
};
