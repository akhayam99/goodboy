import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';
import { listQuietRuns } from '../../../chat/turn';
import type { SignalTurnFiles } from '../../nextStepSignals';

type Params = {
  readonly sessionId: SessionId;
  readonly agents: ReadonlyArray<Agent>;
};

export type TurnSignals = {
  readonly turnFiles: ReadonlyArray<SignalTurnFiles>;
  readonly touches: Readonly<Record<string, number>>;
  readonly quietByAgent: Readonly<Record<string, number>>;
};

const NO_TURN_FILES: ReadonlyArray<SignalTurnFiles> = [];
const NO_QUIET: ReadonlyMap<string, number> = new Map();
const QUIET_POLL_MS = 30_000;
const FIRST_READ_DELAY_MS = 1_500;

export const useTurnSignals = ({ sessionId, agents }: Params): TurnSignals => {
  const turnFiles = useAppStore((state) => state.turnFiles[sessionId] ?? NO_TURN_FILES);
  const refreshTurnFiles = useAppStore((state) => state.refreshTurnFiles);
  const runningIds = useAppStore(
    useShallow((state) =>
      agents.flatMap((agent) =>
        state.agentTurnState[agent.id]?.kind === 'running' ? [agent.id] : [],
      ),
    ),
  );
  const liveRuns = useAppStore(
    useShallow((state) => {
      const runs: Record<string, string> = {};
      for (const agentId of runningIds) {
        const runId = state.agentRunHistory[agentId]?.at(-1);
        if (runId !== undefined) {
          runs[runId] = agentId;
        }
      }
      return runs;
    }),
  );
  const [quietByRun, setQuietByRun] = useState<ReadonlyMap<string, number>>(NO_QUIET);
  const isLive = runningIds.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => void refreshTurnFiles({ sessionId }), FIRST_READ_DELAY_MS);
    return () => clearTimeout(timer);
  }, [refreshTurnFiles, sessionId]);

  useEffect(() => {
    if (!isLive) {
      setQuietByRun(NO_QUIET);
      return;
    }
    let isCurrent = true;
    const read = (): void => {
      void listQuietRuns().then((runs) => {
        if (isCurrent) {
          setQuietByRun(new Map(runs.map((run) => [run.runId, run.quietMs])));
        }
      });
    };
    const first = setTimeout(read, FIRST_READ_DELAY_MS);
    const stopPoll = startPoll({
      run: read,
      everyMs: QUIET_POLL_MS,
      gate: 'visible',
      isImmediate: false,
    });
    return () => {
      isCurrent = false;
      clearTimeout(first);
      stopPoll();
    };
  }, [isLive]);

  const touches = useMemo(() => {
    const latest: Record<string, number> = {};
    for (const entry of turnFiles) {
      if (entry.paths.length > 0 && entry.recordedAtMs > (latest[entry.mountId] ?? 0)) {
        latest[entry.mountId] = entry.recordedAtMs;
      }
    }
    return latest;
  }, [turnFiles]);

  const quietByAgent = useMemo(() => {
    const byAgent: Record<string, number> = {};
    for (const [runId, agentId] of Object.entries(liveRuns)) {
      const quietMs = quietByRun.get(runId);
      if (quietMs !== undefined) {
        byAgent[agentId] = quietMs;
      }
    }
    return byAgent;
  }, [liveRuns, quietByRun]);

  return useMemo(() => ({ turnFiles, touches, quietByAgent }), [quietByAgent, touches, turnFiles]);
};
