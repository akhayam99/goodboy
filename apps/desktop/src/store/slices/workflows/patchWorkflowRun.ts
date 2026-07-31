import type { SessionId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly patch: (run: WorkflowRun) => WorkflowRun;
};

export const patchWorkflowRun = ({ set, sessionId, workflowRunId, patch }: Params): void => {
  set((state) => ({
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            workflowRuns: session.workflowRuns.map((run) =>
              run.id === workflowRunId ? patch(run) : run,
            ),
          }
        : session,
    ),
  }));
};

export const withoutKeys = <K extends keyof WorkflowRun>(
  run: WorkflowRun,
  keys: ReadonlyArray<K>,
): WorkflowRun => {
  const next = { ...run } as Record<string, unknown>;
  keys.forEach((key) => delete next[key as string]);
  return next as WorkflowRun;
};
