import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core/workflows';
import type { ShowToast } from '../../shared/components/Toast';
import type { AppStore } from '../../store/store';
import { offerResume, type ResumeState } from '../session/offerResume';
import { CLOSE_WORKFLOW_COPY } from './closeWorkflowCopy';

type Params = {
  readonly getState: () => Pick<AppStore, 'sessionPhaseRuns' | 'stopWorkflowRunNow'> & ResumeState;
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly showToast: ShowToast;
};

export const stopRunWithResume = async ({
  getState,
  sessionId,
  runId,
  showToast,
}: Params): Promise<void> => {
  const running = runsForWorkflowRun(getState().sessionPhaseRuns[sessionId] ?? [], runId).filter(
    (agent) => agent.status === 'running',
  );
  const outcome = await getState().stopWorkflowRunNow(sessionId, runId);
  if (outcome !== 'stopped') {
    return;
  }
  const message = CLOSE_WORKFLOW_COPY.stopped;
  const agentIds = running.map((agent) => agent.id);
  if (offerResume({ getState, sessionId, agentIds, message, showToast }) === null) {
    showToast({ kind: 'info', message });
  }
};
