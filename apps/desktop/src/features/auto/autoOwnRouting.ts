import { AUTO_DEFAULTS, isAutoOwnProvider } from '@goodboy/core';
import type { AgentKindRouting } from '../session/agent-kind';

type Params = {
  readonly routing: AgentKindRouting;
};

const FALLBACK_EFFORT = 'medium';

export const autoOwnRouting = ({ routing }: Params): AgentKindRouting => {
  if (isAutoOwnProvider({ provider: routing.provider })) {
    return routing;
  }
  const choice = AUTO_DEFAULTS.anthropic.auto[0];
  if (choice === undefined) {
    return routing;
  }
  return {
    provider: 'anthropic',
    model: choice.key,
    effort: choice.effort ?? FALLBACK_EFFORT,
  };
};
