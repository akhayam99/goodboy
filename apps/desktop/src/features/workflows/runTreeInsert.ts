import type { AgentId } from '@goodboy/types';

export type RunTreeInsert = {
  readonly agentId: AgentId | null;
  readonly slotWidth: number;
};
