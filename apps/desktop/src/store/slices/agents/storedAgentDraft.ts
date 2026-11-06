import type { AgentId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { storageKeyOf } from '../../../shared/lib/storageKeyOf';
import { storedText } from '../../../shared/lib/storedText';

type AgentParams = Readonly<{
  agentId: AgentId;
}>;

type WriteParams = AgentParams &
  Readonly<{
    text: string;
  }>;

type ForgetParams = Readonly<{
  agentIds: ReadonlyArray<AgentId>;
}>;

const agentDraftKeyOf = ({ agentId }: AgentParams): string =>
  storageKeyOf({ prefix: STORAGE_PREFIXES.agentDraft, id: agentId });

export const storedAgentDraft = {
  read: ({ agentId }: AgentParams): string =>
    storedText.read({ key: agentDraftKeyOf({ agentId }) }),
  write: ({ agentId, text }: WriteParams): void =>
    storedText.write({ key: agentDraftKeyOf({ agentId }), text }),
  forget: ({ agentIds }: ForgetParams): void => {
    for (const agentId of agentIds) {
      storedText.write({ key: agentDraftKeyOf({ agentId }), text: '' });
    }
  },
};
