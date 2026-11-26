import type { RunDecision } from '../contract/decisions';
import { runStateFrom } from '../actions/targets';
import { actionIdOf } from './actionIdOf';
import type { WorkspaceScope } from './workspaceScope';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

export const runDecisionOf = ({ scope, sessionId }: Params): RunDecision | null => {
  const session = sessionById(scope.sessions, sessionId);
  const agents = scope.agents[sessionId] ?? [];
  for (const run of session?.workflowRuns ?? []) {
    if (run.discardedAt != null) {
      continue;
    }
    const state = runStateFrom({
      run,
      agents: agents.filter((agent) => agent.workflowRunId === run.id),
      stepCount: scope.stepCounts?.[run.workflowId],
    });
    if (state !== 'stopped' && state !== 'waiting' && state !== 'paused') {
      continue;
    }
    return {
      kind: 'run',
      actionId: actionIdOf({ kind: 'continueRun', objectId: run.id, version: state }),
      runId: run.id,
      seenState: state,
      stopActionId: null,
    };
  }
  return null;
};
