import { useEffect, useMemo, useState } from 'react';
import type { Agent, ProviderRunId, SessionId, TurnFileSet } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { doneFilesByAgentOf } from '../../central/done/doneFilesOf';
import type { DoneFiles } from '../../central/done/doneTypes';
import { loadTurnFileSets } from '../../central/done/turnFiles';

type Params = {
  readonly sessionId: SessionId;
  readonly agents: ReadonlyArray<Agent>;
  readonly agentRunHistory: Readonly<Record<string, ReadonlyArray<ProviderRunId>>>;
};

type Loaded = {
  readonly sessionId: SessionId;
  readonly sets: ReadonlyArray<TurnFileSet>;
};

const NO_SETS: ReadonlyArray<TurnFileSet> = [];

export const useTurnFiles = ({
  sessionId,
  agents,
  agentRunHistory,
}: Params): ReadonlyMap<string, DoneFiles> => {
  const reportError = useAppStore((state) => state.reportError);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const refreshKey = useMemo(
    () =>
      agents
        .map(
          (agent) =>
            `${agent.id}:${agentRunHistory[agent.id]?.length ?? 0}:${agent.lastFinishedAt ?? agent.completedAt ?? ''}`,
        )
        .join('|'),
    [agents, agentRunHistory],
  );

  useEffect(() => {
    let isCurrent = true;
    loadTurnFileSets({ sessionId }).then(
      (sets) => {
        if (isCurrent) {
          setLoaded({ sessionId, sets });
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          void reportError({ title: "Couldn't read what each turn changed", error });
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [sessionId, refreshKey, reportError]);

  return useMemo(() => {
    const sets = loaded !== null && loaded.sessionId === sessionId ? loaded.sets : NO_SETS;
    const runIdsByAgentId = new Map(
      agents.map((agent) => [String(agent.id), agentRunHistory[agent.id] ?? []] as const),
    );
    return doneFilesByAgentOf({ sets, runIdsByAgentId });
  }, [loaded, sessionId, agents, agentRunHistory]);
};
