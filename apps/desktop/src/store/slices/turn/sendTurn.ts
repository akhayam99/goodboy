import { releaseWorktreeWriter } from '../../../features/worktree/worktree';
import { closeTurnStartWindow } from './turnStartWindow';
import { markTurnActive, markTurnSettled } from './turnSettled';
import { claimWorkflowTurn } from './workflowTurnBreaker';
import { resetMountContinuationChain } from './mountContinuations';
import type { GetFn, SendTurnResult, SetFn, SendTurnInput, TurnLease } from './types';
import { prepareTurn } from './prepareTurn';
import { routeTurn } from './routeTurn';
import { leaseTurnWriter } from './leaseTurnWriter';
import { releaseTurnWriteSet } from './releaseTurnWriteSet';
import { startTurnRun } from './startTurnRun';
import { buildTurnPrompt } from './buildTurnPrompt';
import { buildTurnSpawn } from './buildTurnSpawn';
import { readTurnStream } from './readTurnStream';
import { finalizeTurnStream } from './finalizeTurnStream';
import { recoverTurnFailure } from './recoverTurnFailure';
import { closeTurnCapture } from './closeTurnCapture';
import { discardInPlaceCapture } from './discardInPlaceCapture';
import { settleTurn } from './settleTurn';
import { continueOnRequestedMount } from './continueOnRequestedMount';
import { haltRunawayWorkflowAgent } from './haltRunawayWorkflowAgent';
import { noticeAutoOfChildTurn } from '../../runtime/auto/noticeAutoOfChildTurn';
import { routeAutoUserTurn } from '../../runtime/auto/routeAutoUserTurn';
import { lookupDeliveryRun } from '../../../features/chat/turn';
import { handDelivery } from './handDelivery';
import { waitForClusterOverlap } from './clusterOverlap/waitForClusterOverlap';

type DiscardParams = Readonly<{
  error: unknown;
}>;

type RunOnceParams = Readonly<{
  input: SendTurnInput;
  lease: TurnLease;
}>;

const NO_KNOWN_RUN = null;

const ALREADY_SENT: SendTurnResult = { blockedOverBudget: false, isAlreadySent: true };

export const sendTurn = (set: SetFn, get: GetFn) => {
  const runOnce = async ({ input: given, lease }: RunOnceParams): Promise<SendTurnResult> => {
    const input = handDelivery.withId({ input: given });
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
    const leased = await leaseTurnWriter({ set, get, lease, ctx: leaseCtx });
    if (leased.isDone) {
      return leased.result;
    }
    const startCtx = { ...leaseCtx, ...leased.value };
    const discardUnspawned = async ({ error }: DiscardParams): Promise<never> => {
      await discardInPlaceCapture({ capture: startCtx.inPlaceCapture });
      throw error;
    };
    const started = await startTurnRun({ set, get, ctx: startCtx }).catch((error: unknown) =>
      discardUnspawned({ error }),
    );
    if (started.isDone) {
      await discardInPlaceCapture({ capture: startCtx.inPlaceCapture });
      return started.result;
    }
    const promptCtx = { ...startCtx, ...started.value };
    const prompt = await buildTurnPrompt({ get, ctx: promptCtx }).catch((error: unknown) =>
      discardUnspawned({ error }),
    );
    const spawnCtx = { ...promptCtx, ...prompt };
    const spawn = await buildTurnSpawn({ set, get, lease, ctx: spawnCtx }).catch((error: unknown) =>
      discardUnspawned({ error }),
    );
    const ctx = { ...spawnCtx, ...spawn };
    input.onStarted?.();
    try {
      await readTurnStream({ set, get, ctx });
      await finalizeTurnStream({ set, get, ctx });
    } catch (err) {
      const recovered = await recoverTurnFailure({ set, get, lease, ctx, err, runOnce });
      if (recovered !== null) {
        return recovered;
      }
    } finally {
      await closeTurnCapture({ get, ctx });
    }
    return await settleTurn({ set, get, ctx });
  };
  const run = async (input: SendTurnInput): Promise<SendTurnResult> => {
    if (input.retry === undefined && input.agentId !== undefined) {
      get().clearAgentLimitStops({ agentId: input.agentId });
    }
    if (input.origin !== 'mount-continuation') {
      resetMountContinuationChain({ sessionId: input.sessionId });
    }
    if (input.origin === undefined || input.origin === 'operator') {
      void get().flushChatLinks({ sessionId: input.sessionId });
    }
    const autoResult = await routeAutoUserTurn({ get, input });
    if (autoResult !== null) {
      return autoResult;
    }
    await noticeAutoOfChildTurn({ get, input });
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
    const callerDeliveryId = handDelivery.isHandSent({ input }) ? input.deliveryId : undefined;
    if (callerDeliveryId !== undefined) {
      const isClaimed = handDelivery.claim({ deliveryId: callerDeliveryId });
      const existing = isClaimed
        ? await lookupDeliveryRun({ deliveryId: callerDeliveryId }).catch(() => NO_KNOWN_RUN)
        : null;
      if (!isClaimed || existing !== null) {
        if (isClaimed) {
          handDelivery.release({ deliveryId: callerDeliveryId });
        }
        return ALREADY_SENT;
      }
    }
    const lease: TurnLease = {
      path: null,
      holder: null,
      token: null,
      attemptId: undefined,
      writeSet: [],
      writeSetHolder: null,
    };
    const settledAgentId = input.agentId ?? get().selectedAgentId[input.sessionId] ?? null;
    if (settledAgentId !== null) {
      markTurnActive({ agentId: settledAgentId });
    }
    try {
      const overlap = await waitForClusterOverlap({ set, get, input });
      if (overlap !== 'proceed') {
        return { blockedOverBudget: false, isWriterLeaseDenied: overlap === 'timed_out' };
      }
      return await runOnce({ input, lease });
    } finally {
      if (callerDeliveryId !== undefined) {
        handDelivery.release({ deliveryId: callerDeliveryId });
      }
      if (input.agentId !== undefined) {
        closeTurnStartWindow({ agentId: input.agentId });
      }
      const { path, holder, attemptId } = lease;
      const heldWriter = path !== null && holder !== null;
      if (heldWriter) {
        await releaseWorktreeWriter({ path, holder });
      }
      await releaseTurnWriteSet({ get, sessionId: input.sessionId, lease });
      if (heldWriter || attemptId !== undefined) {
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
