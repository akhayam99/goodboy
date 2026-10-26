import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly fixAgentId: AgentId | undefined;
};

export const pushCheckFix = async ({ sessionId, mountId, fixAgentId }: Params): Promise<void> => {
  const state = useAppStore.getState();
  const result = await state.pushBranch({ sessionId, mountId, mode: 'plain' });
  if (!result.ok) {
    throw new Error(result.error);
  }
  if (fixAgentId !== undefined) {
    await useAppStore.getState().readCheckFixCommit({ sessionId, mountId, fixAgentId });
  }
};
