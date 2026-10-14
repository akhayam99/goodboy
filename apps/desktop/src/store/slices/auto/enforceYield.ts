import { AUTO_YIELD_GRACE_SECONDS } from '@goodboy/core';
import { getAutoTree } from '@goodboy/db';
import type { SleepParams } from './startDeliveredTurn';
import type { WatchYieldParams } from './ports';
import type { AgentVerbContext } from './verbContext';

export const YIELD_CANCEL_ATTEMPTS = 3;
export const YIELD_RETRY_MS = 2_000;

export type EnforceYieldParams = Readonly<{
  ctx: AgentVerbContext;
  watch: WatchYieldParams;
  sleep: (params: SleepParams) => Promise<void>;
}>;

export type EnforceYieldOutcome = 'ended' | 'cancelled' | 'failed';

export const enforceYield = async ({
  ctx,
  watch,
  sleep,
}: EnforceYieldParams): Promise<EnforceYieldOutcome> => {
  await sleep({ ms: AUTO_YIELD_GRACE_SECONDS * 1000 });
  for (let attempt = 0; attempt < YIELD_CANCEL_ATTEMPTS; attempt += 1) {
    const tree = await getAutoTree({ db: ctx.db, treeId: watch.treeId });
    const isStillRunning =
      tree !== null && tree.generation === watch.generation && tree.activeRunId === watch.runId;
    if (tree === null || !isStillRunning) {
      return 'ended';
    }
    const cancelled = await ctx.ports.cancelRun({
      sessionId: tree.sessionId,
      agentId: tree.rootAgentId,
    });
    if (cancelled.outcome === 'exited') {
      return 'cancelled';
    }
    await sleep({ ms: YIELD_RETRY_MS });
  }
  const last = await getAutoTree({ db: ctx.db, treeId: watch.treeId });
  if (last === null || last.activeRunId !== watch.runId) {
    return 'ended';
  }
  await ctx.scheduler.transition({
    treeId: last.id,
    expect: { phaseRev: last.phaseRev, generation: last.generation, from: [last.phase] },
    to: 'blocked',
    patch: {
      blockedReason: 'Auto did not stop after handing the work over. Stop it and try again.',
    },
  });
  return 'failed';
};
