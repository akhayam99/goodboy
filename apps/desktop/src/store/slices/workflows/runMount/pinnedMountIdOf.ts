import type { Agent, MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { selectRunStepMountId } from './selectRunStepMountId';

type State = Pick<AppState, 'sessionMounts' | 'sessionProjectMounts' | 'sessionPhaseRuns'>;

type Params = Readonly<{
  state: State;
  sessionId: SessionId;
  agent: Agent;
}>;

export const pinnedMountIdOf = ({ state, sessionId, agent }: Params): MountId | null =>
  agent.mountId ??
  selectRunStepMountId({
    state,
    sessionId,
    workflowRunId: agent.workflowRunId ?? null,
  });
