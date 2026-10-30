import type { AgentId } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../../features/workflows/workflows';
import type { SetFn } from '../types';
import { placeAgent } from './placeAgent';
import { RunStepMountBlockedError } from './RunStepMountBlockedError';

type Params = Readonly<{
  set: SetFn;
  agentId: AgentId;
  branch: string | null;
}>;

export const blockRunStepOnGoneMount = async ({ set, agentId, branch }: Params): Promise<never> => {
  placeAgent({ set, agent: await invokeAgentUpdateStatus(agentId, { status: 'blocked' }) });
  throw new RunStepMountBlockedError({
    message: `This step needs ${branch === null ? 'the branch the run started on' : branch}, which was detached from this session. Reattach it or pick another branch to continue.`,
  });
};
