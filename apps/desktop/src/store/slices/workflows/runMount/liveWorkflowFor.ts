import type { SessionId, Workflow, WorkflowRunId } from '@goodboy/types';
import { sessionById } from '../../sessions/sessionIndex';
import type { GetFn } from '../types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly snapshot: Workflow;
};

export const liveWorkflowFor = ({ get, sessionId, workflowRunId, snapshot }: Params): Workflow => {
  const run = sessionById(get().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === workflowRunId,
  );
  const targetId = run?.workflowId ?? snapshot.id;
  return (
    (get().phaseTemplates[snapshot.workspaceId] ?? []).find(
      (candidate) => candidate.id === targetId,
    ) ?? snapshot
  );
};
