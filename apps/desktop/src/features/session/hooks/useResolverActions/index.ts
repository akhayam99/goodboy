import { useEffect, useState } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { PROCEED_RESOLVER_PROMPT } from '../../../../shared/utils/proceedResolverPrompt';
import { RERUN_RESOLVER_PROMPT } from '../../../../shared/utils/rerunResolverPrompt';
import { agentThreadIds } from '../../agentThreadIds';
import type { ResolverStatus } from '../../resolver-linkage';
import { resolverCommitSha } from '../../resolverCommitSha';
import {
  resolverActionPlan,
  type ResolverActionKind,
  type ResolverActionPlan,
} from '../../resolverActions';

const EMPTY_PENDING: ReadonlyArray<never> = [];
const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

type Params = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
  readonly commitSha: string | null;
  readonly isQueueStalled: boolean;
  readonly hasOtherActiveResolvers: boolean;
};

export type ResolverActionsController = {
  readonly plan: ResolverActionPlan;
  readonly explanation: string;
  readonly threadCount: number;
  readonly setExplanation: (value: string) => void;
  readonly resetExplanation: () => void;
  readonly run: (kind: ResolverActionKind) => Promise<void>;
};

export const useResolverActions = ({
  agent,
  sessionId,
  status,
  commitSha,
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
  const [edited, setEdited] = useState<string | null>(null);

  useEffect(() => {
    setEdited(null);
  }, [agent.id]);

  const threadIds = agentThreadIds(agent);
  const fromAgent = threadIds
    .map((id) => {
      const outcome = outcomes[id];
      return outcome?.kind === 'wontfix' ? outcome.reason : null;
    })
    .find((value) => value != null && value.trim() !== '');
  const explanation = edited ?? fromAgent ?? '';

  const pendingResolutions = pending.filter((resolution) =>
    threadIds.includes(resolution.threadId),
  );
  const resolvedTargets = Object.entries(outcomes).flatMap(([targetThreadId, outcome]) =>
    outcome.kind === 'resolved' ? [{ threadId: targetThreadId, commitSha: outcome.commitSha }] : [],
  );
  const effectiveCommitSha = resolverCommitSha({
    threadIds,
    outcomes,
    pendingResolutions: pending,
    reportedSha: commitSha,
  });
  const plan = resolverActionPlan({
    agent,
    status,
    turnState,
    commitSha: effectiveCommitSha,
    queuedThreadIds: pendingResolutions.map((resolution) => resolution.threadId),
    prNumber,
    isQueueStalled,
    hasOtherActiveResolvers,
  });

  const queueTargets =
    resolvedTargets.length > 0
      ? resolvedTargets
      : effectiveCommitSha !== null
        ? threadIds.map((targetThreadId) => ({
            threadId: targetThreadId,
            commitSha: effectiveCommitSha,
          }))
        : [];

  const run = async (kind: ResolverActionKind) => {
    if (kind === 'push') {
      if (threadIds.length === 0 || effectiveCommitSha === null) {
        return;
      }
      await resolveAgentThreads(sessionId, agent.id);
      return;
    }
    if (kind === 'queue') {
      if (prNumber === null) {
        return;
      }
      for (const target of queueTargets) {
        await queueResolution(sessionId, { ...target, prNumber });
      }
      return;
    }
    if (kind === 'dequeue') {
      for (const resolution of pendingResolutions) {
        await dequeueResolution(sessionId, resolution.threadId);
      }
      return;
    }
    if (kind === 'explain' || kind === 'forceResolve') {
      const trimmed = explanation.trim();
      if (kind === 'explain' && trimmed === '') {
        return;
      }
      for (const targetThreadId of threadIds) {
        await resolveGithubThread(
          sessionId,
          targetThreadId,
          trimmed !== '' ? { reason: trimmed } : {},
        );
      }
      setEdited(null);
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

  return {
    plan,
    explanation,
    threadCount: threadIds.length,
    setExplanation: setEdited,
    resetExplanation: () => setEdited(null),
    run,
  };
};
