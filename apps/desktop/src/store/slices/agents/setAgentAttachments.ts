import type { AgentId } from '@goodboy/types';
import type { PageSource } from '../../../shared/types/pageSource';
import type { SetFn } from './types';

export type DraftAttachment = Readonly<{
  id: string;
  fileName: string;
  mimeType: string;
  relPath: string;
  source?: PageSource;
}>;

export const setAgentAttachments = (set: SetFn) => {
  return (agentId: AgentId, attachments: ReadonlyArray<DraftAttachment>) => {
    set((s) => ({ agentAttachments: { ...s.agentAttachments, [agentId]: attachments } }));
  };
};
