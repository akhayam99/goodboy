import { useState } from 'react';
import type { Agent, PendingResolution, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { PROCEED_RESOLVER_PROMPT } from '../../../../shared/utils/proceedResolverPrompt';
import { RERUN_RESOLVER_PROMPT } from '../../../../shared/utils/rerunResolverPrompt';
import { agentThreadIds } from '../../agentThreadIds';
import type { ResolverStatus } from '../../resolver-linkage';
import {
  resolverActionPlan,
  type ResolverActionKind,
  type ResolverActionPlan,
  type ResolverActionSurface,
} from '../../resolverActions';
import {
  resolverThreadSettlements,
  type ResolverThreadSettlement,
} from '../../resolverThreadSettlements';
import { resolverThreadTally, type ResolverThreadTally } from '../../resolverThreadTally';
import { resolverFixThreadPrompt } from '../../resolverFixThreadPrompt';
import { useClosedThreadIds } from '../useClosedThreadIds';

const EMPTY_PENDING: ReadonlyArray<PendingResolution> = [];
const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

type Params = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
  readonly commitSha: string | null;
  readonly surface: ResolverActionSurface;
  readonly isQueueStalled: boolean;
  readonly hasOtherActiveResolvers: boolean;
};

export type ResolverThreadRunParams = {
  readonly threadId: string;
  readonly kind: ResolverActionKind;
  readonly text: string;
};

export type ResolverRunningThreadAction = {
  readonly threadId: string;
  readonly kind: ResolverActionKind;
};

export type ResolverActionsController = {
  readonly plan: ResolverActionPlan;
  readonly threadCount: number;
  readonly settlements: ReadonlyArray<ResolverThreadSettlement>;
  readonly tally: ResolverThreadTally;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
  readonly runningAction: ResolverActionKind | null;
  readonly runningThreadAction: ResolverRunningThreadAction | null;
  readonly run: (kind: ResolverActionKind) => Promise<void>;
  readonly runThread: (params: ResolverThreadRunParams) => Promise<void>;
};

const closureFor = ({
  settlement,
  text,
}: {
  readonly settlement: ResolverThreadSettlement;
  readonly text: string;
}): { commitSha?: string; reason?: string; reply?: string } => {
  const trimmed = text.trim();
  if (trimmed === '') {
    return {};
  }
  return settlement.kind === 'wontfix' ? { reason: trimmed } : { reply: trimmed };
};

const defaultTextFor = ({
  settlement,
}: {
  readonly settlement: ResolverThreadSettlement;
}): string => settlement.reason ?? settlement.reply ?? '';

export const useResolverActions = ({
  agent,
  sessionId,
  status,
  commitSha,
  surface,
  isQueueStalled,
  hasOtherActiveResolvers,
}: Params): ResolverActionsController => {
  const resolveGithubThread = useAppStore((state) => state.resolveGithubThread);
  const resolveAgentThreads = useAppStore((state) => state.resolveAgentThreads);
  const queueResolution = useAppStore((state) => state.queueResolution);
  const dequeueResolution = useAppStore((state) => state.dequeueResolution);
  const activateNextResolver = useAppStore((state) => state.activateNextResolver);
  const forceCloseResolver = useAppStore((state) => state.forceCloseResolver);
  const sendTurn = useAppStore((state) => state.sendTurn);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const turnState = useAppStore((state) => state.agentTurnState[agent.id]);
  const prNumber = useAppStore((state) => state.sessionGithub[sessionId]?.pr?.number ?? null);
  const pending =
    useAppStore((state) => state.sessionPendingResolutions[sessionId]) ?? EMPTY_PENDING;
  const outcomes = useAppStore((state) => state.resolverThreadOutcomes[agent.id]) ?? EMPTY_OUTCOMES;
  const closedThreadIds = useClosedThreadIds({ sessionId });
  const [runningAction, setRunningAction] = useState<ResolverActionKind | null>(null);
  const [runningThreadAction, setRunningThreadAction] =
    useState<ResolverRunningThreadAction | null>(null);

  const threadIds = agentThreadIds(agent);
  const settlements = resolverThreadSettlements({
    threadIds,
    outcomes,
    pendingResolutions: pending,
    closedThreadIds,
  });
  const tally = resolverThreadTally({ settlements });

  const queuedThreadIds = settlements
    .filter((settlement) => settlement.isQueued)
    .map((settlement) => settlement.threadId);
  const plan = resolverActionPlan({
    agent,
    status,
    turnState,
    commitSha,
    tally,
    surface,
    queuedThreadIds,
    prNumber,
    isQueueStalled,
    hasOtherActiveResolvers,
  });

  const queueOne = async ({
    threadId,
    sha,
    reply,
  }: {
    readonly threadId: string;
    readonly sha: string;
    readonly reply: string | null;
  }) => {
    if (prNumber === null) {
      return;
    }
    await queueResolution(sessionId, {
      threadId,
      commitSha: sha,
      prNumber,
      outcome: 'resolved',
      ...(reply !== null && { reply }),
    });
  };

  const queueTargets = settlements.flatMap((settlement) => {
    if (settlement.isClosed) {
      return [];
    }
    if (settlement.kind === 'resolved' && settlement.commitSha !== null && !settlement.isQueued) {
      return [
        { threadId: settlement.threadId, sha: settlement.commitSha, reply: settlement.reply },
      ];
    }
    if (
      settlement.kind === 'open' &&
      settlements.length === 1 &&
      tally.settled === 0 &&
      commitSha !== null
    ) {
      return [{ threadId: settlement.threadId, sha: commitSha, reply: null }];
    }
    return [];
  });

  const dispatchThread = async ({ threadId, kind, text }: ResolverThreadRunParams) => {
    const settlement = settlements.find((candidate) => candidate.threadId === threadId);
    if (settlement === undefined) {
      return;
    }
    if (kind === 'queue') {
      const sha = settlement.commitSha ?? commitSha;
      if (sha === null) {
        return;
      }
      await queueOne({ threadId, sha, reply: text.trim() === '' ? settlement.reply : text.trim() });
      return;
    }
    if (kind === 'dequeue') {
      await dequeueResolution(sessionId, threadId);
      return;
    }
    if (kind === 'explain') {
      const closure = closureFor({ settlement, text });
      if (Object.keys(closure).length === 0) {
        return;
      }
      await resolveGithubThread(sessionId, threadId, closure);
      return;
    }
    if (kind === 'forceResolve') {
      await resolveGithubThread(sessionId, threadId, closureFor({ settlement, text }));
      return;
    }
    if (kind === 'fix') {
      await selectAgent(sessionId, agent.id);
      await sendTurn({
        sessionId,
        agentId: agent.id,
        content: resolverFixThreadPrompt({ threadId }),
      });
      return;
    }
    if (kind === 'answer') {
      await selectAgent(sessionId, agent.id);
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
      window.dispatchEvent(new CustomEvent('goodboy:focus-composer'));
    }
  };

  const closeSettled = async ({ includeOpen }: { readonly includeOpen: boolean }) => {
    for (const settlement of settlements) {
      if (settlement.kind === 'resolved' || settlement.isClosed) {
        continue;
      }
      if (settlement.kind === 'open' && !includeOpen) {
        continue;
      }
      const text = defaultTextFor({ settlement });
      if (!includeOpen && text.trim() === '') {
        continue;
      }
      await resolveGithubThread(sessionId, settlement.threadId, closureFor({ settlement, text }));
    }
  };

  const dispatch = async (kind: ResolverActionKind) => {
    if (kind === 'review' || kind === 'fix') {
      return;
    }
    if (kind === 'push') {
      if (threadIds.length === 0) {
        return;
      }
      await resolveAgentThreads(sessionId, agent.id);
      return;
    }
    if (kind === 'queue') {
      for (const target of queueTargets) {
        await queueOne(target);
      }
      return;
    }
    if (kind === 'dequeue') {
      for (const threadId of queuedThreadIds) {
        await dequeueResolution(sessionId, threadId);
      }
      return;
    }
    if (kind === 'explain') {
      await closeSettled({ includeOpen: false });
      return;
    }
    if (kind === 'forceResolve') {
      await closeSettled({ includeOpen: true });
      return;
    }
    if (kind === 'proceed') {
      await sendTurn({ sessionId, agentId: agent.id, content: PROCEED_RESOLVER_PROMPT });
      return;
    }
    if (kind === 'rerun') {
      await selectAgent(sessionId, agent.id);
      await sendTurn({ sessionId, agentId: agent.id, content: RERUN_RESOLVER_PROMPT });
      return;
    }
    if (kind === 'answer') {
      await selectAgent(sessionId, agent.id);
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
      window.dispatchEvent(new CustomEvent('goodboy:focus-composer'));
      return;
    }
    if (kind === 'run') {
      await activateNextResolver(sessionId);
      return;
    }
    await forceCloseResolver(sessionId, agent.id);
  };

  const run = async (kind: ResolverActionKind) => {
    setRunningAction(kind);
    try {
      await dispatch(kind);
    } finally {
      setRunningAction(null);
    }
  };

  const runThread = async (params: ResolverThreadRunParams) => {
    setRunningThreadAction({ threadId: params.threadId, kind: params.kind });
    try {
      await dispatchThread(params);
    } finally {
      setRunningThreadAction(null);
    }
  };

  return {
    plan,
    threadCount: threadIds.length,
    settlements,
    tally,
    prNumber,
    isBusy: turnState?.kind === 'running' || turnState?.kind === 'starting',
    runningAction,
    runningThreadAction,
    run,
    runThread,
  };
};
