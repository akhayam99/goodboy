import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { autoTreeOfAgent } from '../../../../features/auto/autoTreeOfAgent';
import { useAutoTreeViews } from '../../../../features/auto/useAutoTreeViews';
import { usePresetRunFocus } from '../../../../features/session/hooks/usePresetRunFocus';
import { classifyAgent } from '../../../../features/session/agent-kind';
import type { SpawnedFocus } from '../spawnedFocus';

type Params = {
  readonly sessionId: SessionId;
};

export const useSpawnedFocus = ({ sessionId }: Params): SpawnedFocus | null => {
  const runFocus = usePresetRunFocus({ sessionId });
  const views = useAutoTreeViews({ sessionId });
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
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
    if (runId !== null) {
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
  }, [runId, selectedAgentId, isAutoRoot, views]);
};
