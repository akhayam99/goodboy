import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { classifyAgent, type AgentKind } from '../../../../../session/agent-kind';
import { RUNNING_KINDS } from '../../lib';

type Params = {
  readonly session: Session;
};

export const useAgentSelection = ({ session }: Params) => {
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null);
  const agentKindOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentKindOverride[selectedAgentId] ?? null) : null,
  );
  const selectedAgentName = useAppStore((s) => {
    if (!selectedAgentId) {
      return null;
    }
    const runs = s.sessionPhaseRuns[session.id] ?? [];
    return runs.find((r) => r.id === selectedAgentId)?.name ?? null;
  });
  const selectedAgentPersistedKind = useAppStore((s) => {
    if (!selectedAgentId) {
      return null;
    }
    const runs = s.sessionPhaseRuns[session.id] ?? [];
    return runs.find((r) => r.id === selectedAgentId)?.kind ?? null;
  });
  const activeAgentKind: AgentKind | null =
    selectedAgentName !== null
      ? classifyAgent({
          agent: { name: selectedAgentName, kind: selectedAgentPersistedKind ?? undefined },
          override: agentKindOverride,
        })
      : agentKindOverride;
  const sessionWorktree = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const selectedAgentState = useAppStore((s) =>
    selectedAgentId ? (s.agentTurnState[selectedAgentId] ?? null) : null,
  );
  const isFirstTurnForAgent = useAppStore((s) =>
    selectedAgentId ? (s.agentRunHistory[selectedAgentId]?.length ?? 0) === 0 : false,
  );
  const isRunning = RUNNING_KINDS.has(selectedAgentState?.kind ?? session.state.kind);

  return {
    selectedAgentId,
    activeAgentKind,
    sessionWorktree,
    isFirstTurnForAgent,
    isRunning,
  };
};
