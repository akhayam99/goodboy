import { useMemo } from 'react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { useAppStore, useTranscript } from '../../../../store';
import { autoRootTitleOf } from '../../../../features/session/components/AutoAgentsPane/autoRootTitleOf';
import { useAutoTreeRows } from '../../../../features/auto/useAutoTreeRows';
import { autoSpawnedRowsOf } from '../autoSpawnedRowsOf';
import type { SpawnedRow } from '../spawnedRow';

const NO_AGENTS: ReadonlyArray<Agent> = [];

type Params = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
};

type AutoSpawnedRows = Readonly<{
  rows: ReadonlyArray<SpawnedRow>;
  isLoaded: boolean;
}>;

export const useAutoSpawnedRows = ({ sessionId, rootAgentId }: Params): AutoSpawnedRows => {
  const model = useAutoTreeRows({ sessionId, agentId: rootAgentId });
  const rootName = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === rootAgentId)?.name ??
      'Auto',
  );
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const events = useTranscript(rootAgentId);
  const ask = model.tree?.view.rootAsk ?? null;
  const rootTitle = useMemo(
    () => autoRootTitleOf({ name: rootName, ask, events }),
    [rootName, ask, events],
  );
  const rows = useMemo(
    () =>
      autoSpawnedRowsOf({ rows: model.rows, baseLevel: 1, agents }).map((row) =>
        row.level === 1 ? { ...row, title: rootTitle } : row,
      ),
    [model.rows, rootTitle, agents],
  );
  return { rows, isLoaded: model.tree !== null };
};
