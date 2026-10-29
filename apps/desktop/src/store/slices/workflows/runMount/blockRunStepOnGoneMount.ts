import type { AgentId, SessionId } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../../features/workflows/workflows';
import type { SetFn } from '../types';

type Params = Readonly<{
  set: SetFn;
  sessionId: SessionId;
  agentId: AgentId;
  branch: string | null;
}>;

export const blockRunStepOnGoneMount = async ({
  set,
  sessionId,
  agentId,
  branch,
}: Params): Promise<never> => {
  const blocked = await invokeAgentUpdateStatus(agentId, { status: 'blocked' });
  set((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((candidate) =>
        candidate.id === blocked.id ? blocked : candidate,
      ),
    },
  }));
  throw new Error(
    `This run step is pinned to ${branch === null ? 'the branch the run started on' : `the branch ${branch}`}, which is no longer in the session. Pick another branch mount to continue.`,
  );
};
