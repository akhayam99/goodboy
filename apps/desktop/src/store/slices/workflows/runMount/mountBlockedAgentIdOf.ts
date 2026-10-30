import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { selectMountBlockedStep } from './selectMountBlockedStep';

type Params = Readonly<{
  state: Pick<AppState, 'sessionMounts' | 'sessionProjectMounts' | 'sessionPhaseRuns'>;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId;
}>;

export const mountBlockedAgentIdOf = ({
  state,
  sessionId,
  workflowRunId,
}: Params): AgentId | null =>
  selectMountBlockedStep({ state, sessionId, workflowRunId, activeMountId: null })?.agentId ?? null;
