import { useShallow } from 'zustand/react/shallow';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AgentProviderId } from '../../../../store/slices/providers/probeAgent';
import type { ProviderStatus } from '../../../providers/providers';
import { AGENT_ROW_IDS } from '../agentRowIds';
import { agentRowOf, type AgentRow } from '../agentRowOf';
import { readyAgents } from '../readyAgents';
import { statusOfInfo } from '../../../providers/statusOfInfo';
import { useAgentDetection, type AgentDetection } from '../useAgentDetection';

export type AgentRows = {
  readonly rows: ReadonlyArray<AgentRow>;
  readonly ready: ReadonlyArray<ProviderId>;
  readonly detection: AgentDetection;
};

type InfoParams = {
  readonly id: AgentProviderId;
};

export const useAgentRows = (): AgentRows => {
  const detection = useAgentDetection();
  const providers = useAppStore((state) => state.providers);
  const connect = useAppStore((state) => state.providerConnect);
  const stored = useAppStore(
    useShallow((state) => ({
      anthropic: state.providerStatus,
      codex: state.codexStatus,
      cursor: state.cursorStatus,
      gemini: state.geminiStatus,
    })),
  );
  const infoOf = ({ id }: InfoParams) => providers.find((provider) => provider.id === id) ?? null;
  const statuses: Readonly<Record<AgentProviderId, ProviderStatus | null>> = {
    ...stored,
    copilot: statusOfInfo({ id: 'copilot', info: infoOf({ id: 'copilot' }) }),
  };
  const rows = AGENT_ROW_IDS.map((id) =>
    agentRowOf({
      id,
      info: infoOf({ id }),
      status: statuses[id],
      connect: connect[id],
      check: detection.checks[id],
    }),
  );
  return { rows, ready: readyAgents({ providers }), detection };
};
