import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { autoTreeOfAgent } from '../../../../features/auto/autoTreeOfAgent';
import { useAutoTreeViews } from '../../../../features/auto/useAutoTreeViews';
import { usePresetRunFocus } from '../../../../features/session/hooks/usePresetRunFocus';
import type { SpawnedFocus } from '../spawnedFocus';

type Params = {
  readonly sessionId: SessionId;
};

export const useSpawnedFocus = ({ sessionId }: Params): SpawnedFocus | null => {
  const runFocus = usePresetRunFocus({ sessionId });
  const views = useAutoTreeViews({ sessionId });
  const autoAgentId = useAppStore((state) =>
    state.activeLens[sessionId] === 'auto' ? (state.selectedAgentId[sessionId] ?? null) : null,
  );
  const runId = runFocus?.runId ?? null;
  return useMemo((): SpawnedFocus | null => {
    if (runId !== null) {
      return { kind: 'run', runId };
    }
    if (autoAgentId === null) {
      return null;
    }
    const tree = autoTreeOfAgent({ views, agentId: autoAgentId });
    return { kind: 'auto', rootAgentId: tree?.view.tree.rootAgentId ?? autoAgentId };
  }, [runId, autoAgentId, views]);
};
