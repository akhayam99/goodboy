import type { Agent, MeasuredTurnSpan } from '@goodboy/types';
import { agentRanModels } from '../../timeline/ranModels';

type Params = {
  readonly agent: Agent;
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
  readonly isLive: boolean;
};

export const agentModelLineOf = ({ agent, spans, isLive }: Params): string | null => {
  const { models } = agentRanModels({
    spans,
    agentId: agent.id,
    routing: {
      provider: agent.providerOverride ?? null,
      model: agent.modelOverride ?? null,
      effort: agent.effort ?? null,
    },
    isRoutingPlanned: false,
    isLive,
  });
  const last = models.at(-1);
  if (last === undefined) {
    return null;
  }
  return [last.name, last.effort].filter((part) => part !== null).join(' · ');
};
