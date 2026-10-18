import type { MountId } from '@goodboy/types';
import type { SuggestionAgent } from './deriveNextSteps';

type Params = {
  readonly agents: ReadonlyArray<SuggestionAgent>;
  readonly mountId: MountId;
};

export const isMountBusyOf = ({ agents, mountId }: Params): boolean =>
  agents.some((agent) => agent.status === 'running' && agent.mountId === mountId);
