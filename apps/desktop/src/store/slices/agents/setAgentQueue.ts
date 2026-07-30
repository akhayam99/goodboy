import type { AgentId, TurnProviderOverride } from '@goodboy/types';
import type { SetFn } from './types';

export type QueuedAttachment = Readonly<{
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  relPath: string | null;
}>;

export type AgentQueuedTurn = Readonly<{
  id: string;
  agentId: AgentId;
  content: string;
  attachments: ReadonlyArray<QueuedAttachment>;
  override: TurnProviderOverride | undefined;
}>;

export const setAgentQueue = (set: SetFn) => {
  return (agentId: AgentId, queue: ReadonlyArray<AgentQueuedTurn>) => {
    set((s) => {
      if (queue.length === 0 && !(agentId in s.agentQueue)) {
        return s;
      }
      if (queue.length === 0) {
        const next = { ...s.agentQueue };
        delete next[agentId];
        return { agentQueue: next };
      }
      return { agentQueue: { ...s.agentQueue, [agentId]: queue } };
    });
  };
};
