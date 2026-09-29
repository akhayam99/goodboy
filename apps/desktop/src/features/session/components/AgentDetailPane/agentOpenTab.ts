import type { AgentPane } from '../../../../store/slices/navigation/types';

export type AgentTab = AgentPane;

type Params = {
  readonly hasOpenQuestions: boolean;
  readonly isResolver: boolean;
};

export const agentOpenTab = ({ hasOpenQuestions, isResolver }: Params): AgentTab =>
  hasOpenQuestions || isResolver ? 'brief' : 'transcript';

export const OPEN_AGENT_INTENT = 'open-agent';

export const openAgentRevealEvent = (): CustomEvent<{ readonly intent: string }> =>
  new CustomEvent('goodboy:reveal-chat', { detail: { intent: OPEN_AGENT_INTENT } });

export const isOpenAgentReveal = (event: Event): boolean =>
  event instanceof CustomEvent &&
  typeof event.detail === 'object' &&
  event.detail !== null &&
  'intent' in event.detail &&
  event.detail.intent === OPEN_AGENT_INTENT;
