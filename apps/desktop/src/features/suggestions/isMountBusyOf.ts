import type { MountId } from '@goodboy/types';
import type { SuggestionAgent } from './deriveNextSteps';

type Params = {
  readonly agents: ReadonlyArray<SuggestionAgent>;
  readonly mountId: MountId;
  readonly mountCount: number;
};

export const isMountBusyOf = ({ agents, mountId, mountCount }: Params): boolean =>
  agents.some((agent) => {
    if (agent.status !== 'running') {
      return false;
    }
    if (agent.mountId === undefined) {
      return mountCount === 1;
    }
    return agent.mountId === mountId;
  });
