import type { OrchestratorHint, WorkflowRun } from '@goodboy/types';

export type HintQueue = Readonly<{
  waiting: ReadonlyArray<OrchestratorHint>;
  queuedCount: number;
}>;

type Params = {
  readonly run: WorkflowRun;
  readonly readingIds: ReadonlyArray<string>;
};

export const hintQueueOf = ({ run, readingIds }: Params): HintQueue => {
  const waiting = (run.orchestratorHints ?? []).filter((hint) => hint.consumedAt == null);
  return {
    waiting,
    queuedCount: waiting.filter((hint) => !readingIds.includes(hint.id)).length,
  };
};
