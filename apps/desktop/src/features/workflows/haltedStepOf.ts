import { isAgentStatusHalted } from '@goodboy/core/workflows';
import type { Agent } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

export const haltedStepOf = ({ agents }: Params): Agent | null =>
  [...agents]
    .sort((left, right) => left.ordinal - right.ordinal)
    .find((agent) => isAgentStatusHalted({ status: agent.status })) ?? null;
