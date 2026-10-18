import { useShallow } from 'zustand/react/shallow';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AGENT_ROW_IDS } from '../agentRowIds';
import { agentRowOf, type AgentRow } from '../agentRowOf';
import { readyAgents } from '../readyAgents';
import { useAgentDetection, type AgentDetection } from '../useAgentDetection';

export type AgentRows = {
  readonly rows: ReadonlyArray<AgentRow>;
  readonly ready: ReadonlyArray<ProviderId>;
  readonly detection: AgentDetection;
};

export const useAgentRows = (): AgentRows => {
  const detection = useAgentDetection();
  const providers = useAppStore((state) => state.providers);
  const connect = useAppStore((state) => state.providerConnect);
  const statuses = useAppStore(
    useShallow((state) => ({
      anthropic: state.providerStatus,
      codex: state.codexStatus,
      cursor: state.cursorStatus,
      gemini: state.geminiStatus,
    })),
  );
  const rows = AGENT_ROW_IDS.map((id) =>
    agentRowOf({
      id,
      info: providers.find((provider) => provider.id === id) ?? null,
      status: statuses[id],
      connect: connect[id],
      check: detection.checks[id],
    }),
  );
  return { rows, ready: readyAgents({ providers }), detection };
};
