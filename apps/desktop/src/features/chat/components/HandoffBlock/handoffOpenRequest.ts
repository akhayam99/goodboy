import type { AgentId } from '@goodboy/types';

export const HANDOFF_OPEN_EVENT = 'goodboy:open-handoff';

const pending = new Set<AgentId>();

type Params = {
  readonly agentId: AgentId;
};

export const requestHandoffOpen = ({ agentId }: Params): void => {
  pending.add(agentId);
  window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  window.dispatchEvent(new CustomEvent(HANDOFF_OPEN_EVENT, { detail: { agentId } }));
};

export const takeHandoffOpenRequest = ({ agentId }: Params): boolean => pending.delete(agentId);
