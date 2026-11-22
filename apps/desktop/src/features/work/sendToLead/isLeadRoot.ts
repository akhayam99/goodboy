import type { Agent } from '@goodboy/types';
import { AUTO_CONFINED_ROLE } from '../../../store/slices/turn/confinedRoleOf';

type Params = {
  readonly agent: Pick<Agent, 'kind' | 'parentAgentId'>;
};

export const isLeadRoot = ({ agent }: Params): boolean =>
  agent.kind === AUTO_CONFINED_ROLE && agent.parentAgentId == null;
