import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';

const NO_AGENTS: ReadonlyArray<Agent> = [];

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionRunHistory = ({
  sessionId,
}: Params): Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>> =>
  useAppStore(
    useShallow((state) => {
      const history: Record<AgentId, ReadonlyArray<ProviderRunId>> = {};
      for (const agent of state.sessionPhaseRuns[sessionId] ?? NO_AGENTS) {
        const runIds = state.agentRunHistory[agent.id];
        if (runIds != null) {
          history[agent.id] = runIds;
        }
      }
      return history;
    }),
  );
