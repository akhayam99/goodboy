import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { selectRunStepMountId } from './selectRunStepMountId';

type State = Pick<
  AppState,
  'sessionMounts' | 'sessionProjectMounts' | 'sessionPhaseRuns' | 'transcripts'
>;

type Params = Readonly<{
  state: State;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId;
}>;

export const hasRunLostItsMount = ({ state, sessionId, workflowRunId }: Params): boolean => {
  if (selectRunStepMountId({ state, sessionId, workflowRunId }) !== null) {
    return false;
  }
  return (state.sessionPhaseRuns[sessionId] ?? []).some(
    (agent) =>
      agent.workflowRunId === workflowRunId &&
      (agent.providerSessionId !== undefined || (state.transcripts[agent.id] ?? []).length > 0),
  );
};
