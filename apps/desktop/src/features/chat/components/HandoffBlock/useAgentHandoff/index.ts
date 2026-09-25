import { useEffect } from 'react';
import type { AgentHandoff, AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly agentId: AgentId | null;
};

export type AgentHandoffState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'missing' }>
  | Readonly<{ status: 'ready'; handoff: AgentHandoff }>;

export const useAgentHandoff = ({ agentId }: Params): AgentHandoffState => {
  const handoff = useAppStore((state) => (agentId === null ? null : state.agentHandoffs[agentId]));
  const loadAgentHandoff = useAppStore((state) => state.loadAgentHandoff);

  useEffect(() => {
    if (agentId === null || handoff !== undefined) {
      return;
    }
    void loadAgentHandoff({ agentId });
  }, [agentId, handoff, loadAgentHandoff]);

  if (agentId === null || handoff === null) {
    return { status: 'missing' };
  }
  if (handoff === undefined) {
    return { status: 'loading' };
  }
  return { status: 'ready', handoff };
};
