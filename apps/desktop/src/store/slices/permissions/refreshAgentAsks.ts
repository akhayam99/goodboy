import { findUndecidedPermissionAsk, listTurnEventEntriesForAgent } from '@goodboy/db';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TurnState,
} from '@goodboy/types';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { nowIso } from '../project-mounts/nowIso';
import { readBackendRunIds } from '../sessions/reconcileSessionRuns';
import { applyAgentTurnState } from '../sessions/sessionMutators';
import { flushTurnEvents } from '../transcripts/buffer';
import { mergeTranscript } from '../transcripts/mergeTranscript';
import { isTurnActive } from '../turn/turnSettled';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type WatchedRunParams = {
  readonly turn: TurnState | undefined;
  readonly agentId: AgentId;
};

type NextTurnParams = {
  readonly agent: Agent | undefined;
  readonly liveRunId: ProviderRunId | null;
  readonly at: IsoDateTime;
};

const ASK_READS = createLatestOnly();

const ENDED_STATUSES: ReadonlySet<AgentStatus> = new Set([
  'completed',
  'failed',
  'blocked',
  'skipped',
  'stopped',
]);

const nextTurnOf = ({ agent, liveRunId, at }: NextTurnParams): TurnState => {
  if (liveRunId !== null) {
    return { kind: 'running', runId: liveRunId, startedAt: agent?.startedAt ?? at };
  }
  if (agent?.status === 'failed') {
    return { kind: 'error', message: 'agent failed', failedAt: agent.completedAt ?? at };
  }
  return { kind: 'idle', lastActivityAt: at };
};

const watchedRunOf = ({ turn, agentId }: WatchedRunParams): ProviderRunId | null => {
  if (isTurnActive({ agentId })) {
    return null;
  }
  return turn?.kind === 'blocked' || turn?.kind === 'running' ? turn.runId : null;
};

export const refreshAgentAsks = ({ set, get }: Deps) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    const turn = get().agentTurnState[agentId];
    const runId = watchedRunOf({ turn, agentId });
    if (runId === null) {
      return;
    }
    const claim = ASK_READS.claim({ key: agentId });
    const isStale = (): boolean => !claim.isCurrent() || get().agentTurnState[agentId] !== turn;
    flushTurnEvents();
    try {
      const [agents, ask, liveRunIds] = await Promise.all([
        invokeAgentList(sessionId),
        findUndecidedPermissionAsk({ db: tauriDatabase, agentId, runId }),
        readBackendRunIds(),
      ]);
      const agent = agents.find((candidate) => candidate.id === agentId);
      const hasEnded = agent !== undefined && ENDED_STATUSES.has(agent.status);
      if (
        isStale() ||
        liveRunIds === null ||
        (turn?.kind === 'blocked' && ask !== null && !hasEnded)
      ) {
        return;
      }
      const liveRunId = !hasEnded && agent?.runId != null ? agent.runId : null;
      const isLive = liveRunId !== null && liveRunIds.includes(liveRunId);
      if (isLive && turn?.kind === 'running') {
        return;
      }
      const stored = await listTurnEventEntriesForAgent({ db: tauriDatabase, agentId });
      if (isStale()) {
        return;
      }
      const at = nowIso({});
      const next = nextTurnOf({ agent, liveRunId: isLive ? liveRunId : null, at });
      set((state) => ({
        transcripts: {
          ...state.transcripts,
          [agentId]: mergeTranscript({ stored, live: state.transcripts[agentId] ?? [] }),
        },
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: agents },
      }));
      applyAgentTurnState(set, sessionId, agentId, next, at);
    } catch (error) {
      void get().reportError({
        title: "Couldn't read the permission state of this agent",
        error,
        sessionId,
      });
    }
  };
};
