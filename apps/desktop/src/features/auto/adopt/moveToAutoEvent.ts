import type { AgentId } from '@goodboy/types';

export const MOVE_TO_AUTO_EVENT = 'goodboy:move-to-auto';

type DetailParams = {
  readonly agentId: AgentId;
};

export const moveToAutoDetail = ({ agentId }: DetailParams): { readonly agentId: AgentId } => ({
  agentId,
});

type EventParams = {
  readonly event: Event;
  readonly agentId: AgentId;
};

export const isMoveToAutoFor = ({ event, agentId }: EventParams): boolean =>
  event instanceof CustomEvent &&
  typeof event.detail === 'object' &&
  event.detail !== null &&
  'agentId' in event.detail &&
  event.detail.agentId === agentId;
