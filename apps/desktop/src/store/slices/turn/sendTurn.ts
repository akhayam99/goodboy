import { releaseWorktreeWriter } from '../../../features/worktree/worktree';
import { closeTurnStartWindow } from './turnStartWindow';
import { markTurnActive, markTurnSettled } from './turnSettled';
import { claimWorkflowTurn } from './workflowTurnBreaker';
import { resetMountContinuationChain } from './mountContinuations';
import type { GetFn, SendTurnResult, SetFn, SendTurnInput, TurnLease } from './types';
import { prepareTurn } from './prepareTurn';
import { routeTurn } from './routeTurn';
import { leaseTurnWriter } from './leaseTurnWriter';
import { startTurnRun } from './startTurnRun';
import { buildTurnPrompt } from './buildTurnPrompt';
import { buildTurnSpawn } from './buildTurnSpawn';
import { readTurnStream } from './readTurnStream';
import { finalizeTurnStream } from './finalizeTurnStream';
import { recoverTurnFailure } from './recoverTurnFailure';
import { closeTurnCapture } from './closeTurnCapture';
import { settleTurn } from './settleTurn';
import { continueOnRequestedMount } from './continueOnRequestedMount';
import { haltRunawayWorkflowAgent } from './haltRunawayWorkflowAgent';

type RunOnceParams = Readonly<{
  input: SendTurnInput;
  lease: TurnLease;
}>;

export const sendTurn = (set: SetFn, get: GetFn) => {
  const runOnce = async ({ input, lease }: RunOnceParams): Promise<SendTurnResult> => {
    const prepared = await prepareTurn({ set, get, input });
    if (prepared.isDone) {
      return prepared.result;
    }
    const routeCtx = { input, ...prepared.value };
    const routed = await routeTurn({ get, ctx: routeCtx });
    if (routed.isDone) {
      return routed.result;
    }
    const leaseCtx = { ...routeCtx, ...routed.value };
    const leased = await leaseTurnWriter({ get, lease, ctx: leaseCtx });
    if (leased.isDone) {
      return leased.result;
    }
    const startCtx = { ...leaseCtx, ...leased.value };
    const started = await startTurnRun({ set, get, ctx: startCtx });
    if (started.isDone) {
      return started.result;
    }
    const promptCtx = { ...startCtx, ...started.value };
    const prompt = await buildTurnPrompt({ get, ctx: promptCtx });
    const spawnCtx = { ...promptCtx, ...prompt };
    const spawn = await buildTurnSpawn({ set, get, lease, ctx: spawnCtx });
    const ctx = { ...spawnCtx, ...spawn };
    try {
      await readTurnStream({ set, get, ctx });
      await finalizeTurnStream({ set, get, ctx });
    } catch (err) {
      const recovered = await recoverTurnFailure({ set, get, lease, ctx, err, runOnce, run });
      if (recovered !== null) {
        return recovered;
      }
    } finally {
      await closeTurnCapture({ get, ctx });
    }
    return await settleTurn({ set, get, ctx });
  };
  const run = async (input: SendTurnInput): Promise<SendTurnResult> => {
    if (input.origin !== 'mount-continuation') {
      resetMountContinuationChain({ sessionId: input.sessionId });
    }
    if (input.origin === undefined || input.origin === 'operator') {
      void get().flushChatLinks({ sessionId: input.sessionId });
    }
    if (input.agentId !== undefined && input.origin === 'workflow') {
      const claim = claimWorkflowTurn({ agentId: input.agentId, nowMs: Date.now() });
      if (claim === 'tripped') {
        return haltRunawayWorkflowAgent({
          set,
          get,
          sessionId: input.sessionId,
          agentId: input.agentId,
        });
      }
    }
    const lease: TurnLease = { path: null, holder: null, token: null, attemptId: undefined };
    const settledAgentId = input.agentId ?? get().selectedAgentId[input.sessionId] ?? null;
    if (settledAgentId !== null) {
      markTurnActive({ agentId: settledAgentId });
    }
    try {
      return await runOnce({ input, lease });
    } finally {
      if (input.agentId !== undefined) {
        closeTurnStartWindow({ agentId: input.agentId });
      }
      const { path, holder, attemptId } = lease;
      if (path !== null && holder !== null) {
        await releaseWorktreeWriter({ path, holder });
        void get().drainResolveQueue({
          sessionId: input.sessionId,
          ...(attemptId !== undefined && { endedAttemptId: attemptId }),
        });
      }
      void continueOnRequestedMount({ get, run, input }).catch((error) =>
        console.error('mount continuation failed', error),
      );
      if (settledAgentId !== null) {
        markTurnSettled({ agentId: settledAgentId });
        void get().drainAgentQueue({ sessionId: input.sessionId, agentId: settledAgentId });
      }
    }
  };
  return run;
};
