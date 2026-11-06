import { useCallback, useEffect } from 'react';
import type { AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';

type Params = {
  readonly selectedAgentId: AgentId | null;
};

export const useComposerDraft = ({ selectedAgentId }: Params) => {
  const value = useAppStore((s) => (selectedAgentId ? (s.agentDraft[selectedAgentId] ?? '') : ''));
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const clearAgentDraft = useAppStore((s) => s.clearAgentDraft);
  const hydrateAgentDraft = useAppStore((s) => s.hydrateAgentDraft);
  useEffect(() => {
    if (selectedAgentId === null) {
      return;
    }
    hydrateAgentDraft({ agentId: selectedAgentId });
  }, [selectedAgentId, hydrateAgentDraft]);
  const setValue = useCallback(
    (next: string) => {
      if (!selectedAgentId) {
        return;
      }
      if (next.length === 0) {
        clearAgentDraft(selectedAgentId);
        return;
      }
      setAgentDraft(selectedAgentId, next);
    },
    [selectedAgentId, setAgentDraft, clearAgentDraft],
  );

  return { value, setValue };
};
