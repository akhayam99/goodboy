import type { AgentId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { storedAgentDraft } from './storedAgentDraft';

type Params = Readonly<{
  agentId: AgentId;
}>;

export const hydrateAgentDraft = ({ set, get }: SliceDeps) => {
  return ({ agentId }: Params): void => {
    if (get().agentDraft[agentId] !== undefined) {
      return;
    }
    const text = storedAgentDraft.read({ agentId });
    if (text === '') {
      return;
    }
    set((s) =>
      s.agentDraft[agentId] === undefined
        ? { agentDraft: { ...s.agentDraft, [agentId]: text } }
        : s,
    );
  };
};
