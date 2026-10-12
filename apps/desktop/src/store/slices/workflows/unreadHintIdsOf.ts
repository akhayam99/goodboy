import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { findWorkflowRun } from './findWorkflowRun';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const unreadHintIdsOf = ({ get, sessionId, workflowRunId }: Params): string[] => {
  const reading = get().orchestratorReadingHints[workflowRunId] ?? [];
  return (findWorkflowRun({ get, sessionId, workflowRunId })?.orchestratorHints ?? [])
    .filter((hint) => hint.consumedAt == null && reading.includes(hint.id) === false)
    .map((hint) => hint.id);
};
