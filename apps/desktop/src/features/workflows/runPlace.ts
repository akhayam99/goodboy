import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { Place } from '../../store/slices/navigation/types';

type Params = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly agentId?: AgentId | null;
};

export const runPlace = ({ sessionId, runId, agentId = null }: Params): Place =>
  sessionPlace({ sessionId, lens: 'workflows', agentId, target: { kind: 'run', runId } });
