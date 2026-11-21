import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core/workflows';
import { NAMES } from '../../shared/utils/names';
import type { ShowToast } from '../../shared/components/Toast';
import type { AppStore } from '../../store/store';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { offerResume, type ResumeState } from '../session/offerResume';
import { CLOSE_WORKFLOW_COPY } from './closeWorkflowCopy';

type Params = {
  readonly getState: () => Pick<
    AppStore,
    'sessionPhaseRuns' | 'sessions' | 'stopWorkflowRunNow' | 'retryWorkflowOrchestration'
  > &
    ResumeState;
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
  if (outcome === 'failed') {
    return;
  }
  const afterwards = runsForWorkflowRun(getState().sessionPhaseRuns[sessionId] ?? [], runId);
  const agentIds = running
    .filter(
      (agent) =>
        outcome === 'stopped' ||
        afterwards.find((step) => step.id === agent.id)?.status === 'stopped',
    )
    .map((agent) => agent.id);
  if (outcome === 'still_running' && agentIds.length === 0) {
    return;
  }
  const message =
    outcome === 'stopped' ? CLOSE_WORKFLOW_COPY.stopped : CLOSE_WORKFLOW_COPY.partlyStopped;
  if (offerResume({ getState, sessionId, agentIds, message, showToast }) !== null) {
    return;
  }
  const run = sessionById(getState().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === runId,
  );
  if (run?.orchestrationStop?.kind !== 'operator' || run.executionMode !== 'dynamic') {
    showToast({ kind: 'info', message });
    return;
  }
  getState().undoable({
    message,
    showToast,
    actionLabel: NAMES.continue,
    doneMessage: 'Continued.',
    isCurrent: () =>
      sessionById(getState().sessions, sessionId)?.workflowRuns.find(
        (candidate) => candidate.id === runId,
      )?.orchestrationStop?.kind === 'operator',
    undo: () => getState().retryWorkflowOrchestration(sessionId, runId),
  });
};
