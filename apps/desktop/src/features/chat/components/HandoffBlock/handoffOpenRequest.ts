import type { AgentId, HandoffSectionKind } from '@goodboy/types';

export const HANDOFF_OPEN_EVENT = 'goodboy:open-handoff';

const pending = new Map<AgentId, HandoffSectionKind>();

type Params = {
  readonly agentId: AgentId;
  readonly section?: HandoffSectionKind;
};

export const requestHandoffOpen = ({ agentId, section = 'ask' }: Params): void => {
  pending.set(agentId, section);
  window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  window.dispatchEvent(new CustomEvent(HANDOFF_OPEN_EVENT, { detail: { agentId } }));
};

export const takeHandoffOpenRequest = ({ agentId }: Params): HandoffSectionKind | null => {
  const section = pending.get(agentId) ?? null;
  pending.delete(agentId);
  return section;
};
