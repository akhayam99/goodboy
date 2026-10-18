import type { AgentId, SessionId, TurnState } from '@goodboy/types';
import { acquireWriteSet, type WriteSetLease } from '../../../features/worktree/worktree';
import { nowIso } from '../project-mounts/nowIso';
import { applyAgentTurnState } from '../sessions/sessionMutators';
import { claimTurnStart, ensureTurnStartWindow, isTurnStartCancelled } from './turnStartWindow';
import type { GetFn, SetFn, TurnLease } from './types';
import { readOnlyAnswers } from './readOnlyAnswers';
import { writerWaiters } from './writerWaiters';

const WRITER_POLL_MS = 1000;
const WRITER_WAIT_LIMIT_MS = 30 * 60 * 1000;

export type WriteSetAcquisition = 'granted' | 'cancelled' | 'timed_out' | 'read_only';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
  paths: ReadonlyArray<string>;
  lease: TurnLease;
}>;

type WaitParams = Readonly<{
  set: SetFn;
  agentId: AgentId;
  sessionId: SessionId;
  blocked: WriteSetLease | null;
}>;

const putWriterWait = ({ set, agentId, sessionId, blocked }: WaitParams): void => {
  set((state) => {
    const rest = Object.fromEntries(
      Object.entries(state.agentWriterWait).filter(([id]) => id !== agentId),
    );
    if (blocked === null) {
      return { agentWriterWait: rest };
    }
    return {
      agentWriterWait: {
        ...rest,
        [agentId]: {
          sessionId,
          blockedPath: blocked.blockedPath ?? '',
          blockedBy: blocked.blockedBy,
          since: state.agentWriterWait[agentId]?.since ?? nowIso({}),
        },
      },
    };
  });
};

export const acquireTurnWriteSet = async ({
  set,
  get,
  sessionId,
  agentId,
  paths,
  lease,
}: Params): Promise<WriteSetAcquisition> => {
  const hold = (granted: WriteSetLease): void => {
    lease.writeSet = granted.entries;
    lease.writeSetHolder = agentId;
  };
  const first = await acquireWriteSet({ paths, holder: agentId });
  if (first.isGranted) {
    hold(first);
    return 'granted';
  }
  readOnlyAnswers.take({ agentId });
  ensureTurnStartWindow({ agentId });
  const previous: TurnState = get().agentTurnState[agentId] ?? {
    kind: 'idle',
    lastActivityAt: nowIso({}),
  };
  const startedAt = nowIso({});
  applyAgentTurnState(set, sessionId, agentId, { kind: 'starting', startedAt }, startedAt);
  const deadline = Date.now() + WRITER_WAIT_LIMIT_MS;
  const leave = (): void => {
    putWriterWait({ set, agentId, sessionId, blocked: null });
    applyAgentTurnState(set, sessionId, agentId, previous, nowIso({}));
  };
  let current = first;
  try {
    while (!current.isGranted) {
      putWriterWait({ set, agentId, sessionId, blocked: current });
      await writerWaiters.wait({ ms: WRITER_POLL_MS });
      if (isTurnStartCancelled({ agentId })) {
        claimTurnStart({ agentId });
        leave();
        return 'cancelled';
      }
      if (readOnlyAnswers.take({ agentId })) {
        leave();
        return 'read_only';
      }
      if (Date.now() >= deadline) {
        leave();
        return 'timed_out';
      }
      current = await acquireWriteSet({ paths, holder: agentId });
    }
  } catch (error) {
    leave();
    throw error;
  }
  putWriterWait({ set, agentId, sessionId, blocked: null });
  hold(current);
  return 'granted';
};
