import type { AgentId } from '@goodboy/types';

type Params = {
  readonly agentId: AgentId | null;
  readonly isStepsOnly: boolean;
  readonly key: string;
};

export const heightKeyOf = ({ agentId, isStepsOnly, key }: Params): string =>
  `${agentId ?? 'none'}:${isStepsOnly ? 'steps' : 'record'}:${key}`;
