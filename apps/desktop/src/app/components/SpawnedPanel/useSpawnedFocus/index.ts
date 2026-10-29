import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { autoTreeOfAgent } from '../../../../features/auto/autoTreeOfAgent';
import { useAutoTreeViews } from '../../../../features/auto/useAutoTreeViews';
import { usePresetRunFocus } from '../../../../features/session/hooks/usePresetRunFocus';
import { classifyAgent } from '../../../../features/session/agent-kind';
import type { SpawnedFocus } from '../spawnedFocus';

type Params = {
  readonly sessionId: SessionId;
  readonly revealedAgentId: AgentId | null;
};

export const useSpawnedFocus = ({ sessionId, revealedAgentId }: Params): SpawnedFocus | null => {
  const runFocus = usePresetRunFocus({ sessionId });
  const views = useAutoTreeViews({ sessionId });
  const mainAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
  const selectedAgentId = revealedAgentId ?? mainAgentId;
  const isAutoRoot = useAppStore((state) => {
    const agent = (state.sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === selectedAgentId,
    );
    return (
      agent !== undefined &&
      classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null }) === 'auto'
    );
  });
  const runId = runFocus?.runId ?? null;
  return useMemo((): SpawnedFocus | null => {
    if (runId !== null && revealedAgentId === null) {
      return { kind: 'run', runId };
    }
    if (selectedAgentId === null) {
      return null;
    }
    const tree = autoTreeOfAgent({ views, agentId: selectedAgentId });
    if (tree !== null) {
      return { kind: 'auto', rootAgentId: tree.view.tree.rootAgentId };
    }
    return isAutoRoot ? { kind: 'auto', rootAgentId: selectedAgentId } : null;
  }, [runId, selectedAgentId, revealedAgentId, isAutoRoot, views]);
};
