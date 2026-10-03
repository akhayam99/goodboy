import { useShallow } from 'zustand/react/shallow';
import type { Agent } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { NOT_LIVE, quietMsOf, quietSignalOf } from '../../quietSignal';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

export type QuietStep = {
  readonly agent: Agent;
  readonly quietMs: number;
  readonly lastLabel: string | null;
};

const QUIET_TICK_MS = 30_000;

export const useQuietStep = ({ agents }: Params): QuietStep | null => {
  const agent =
    agents.find((candidate) => candidate.parentAgentId == null && candidate.status === 'running') ??
    null;
  const agentId = agent?.id ?? null;
  const signal = useAppStore(
    useShallow((state) =>
      agentId === null
        ? NOT_LIVE
        : quietSignalOf({
            turn: state.agentTurnState[agentId],
            events: state.transcripts[agentId],
          }),
    ),
  );
  const isWatching = signal.isLive && !signal.isToolOpen;
  const nowMs = useNow(QUIET_TICK_MS, isWatching);
  const quietMs = quietMsOf({ signal, nowMs });
  if (agent === null || quietMs === null) {
    return null;
  }
  return { agent, quietMs, lastLabel: signal.lastLabel };
};
