import type { WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: Pick<WorkflowRun, 'orchestrationStop'> | null | undefined;
};

export const isRunPaused = ({ run }: Params): boolean => run?.orchestrationStop?.kind === 'paused';
