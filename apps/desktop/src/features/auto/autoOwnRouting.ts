import { AUTO_DEFAULTS } from '@goodboy/core';
import type { AgentKindRouting } from '../session/agent-kind';
import { AUTO_OWN_PROVIDERS } from './autoProviders';

type Params = {
  readonly routing: AgentKindRouting;
};

const FALLBACK_EFFORT = 'medium';

export const autoOwnRouting = ({ routing }: Params): AgentKindRouting => {
  if (AUTO_OWN_PROVIDERS.includes(routing.provider)) {
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
