import { releaseTurnAdmission } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { CHECK_STATE } from '../notifications/errorRecovery';
import { releaseWorktreeWriter } from '../../../features/worktree/worktree';
import { cancelledRunIds } from '../sessions/sessionMutators';
import { closeUnspawnedRun } from './unstartedTurn/closeUnspawnedRun';
import { releaseUnstartedTurn } from './unstartedTurn/releaseUnstartedTurn';
import { closeTurnStartWindow } from './turnStartWindow';
import { markTurnActive, markTurnSettled, waitTurnSettledFor } from './turnSettled';
import { watchStepEnd } from '../workflows/stepEnd/watchStepEnd';
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
import { announceAgentTurn } from '../permissions/announceAgentTurn';
import { routeAutoChildTurn } from '../../runtime/auto/talk/routeAutoChildTurn';
import { routeAutoUserTurn } from '../../runtime/auto/routeAutoUserTurn';
import { cancelTurn, lookupDeliveryRun } from '../../../features/chat/turn';
import { stopLingeringTurn } from '../../../features/chat/stopLingeringTurn';
import { handDelivery } from './handDelivery';
import { workspaceVerification } from '../project-mounts/verify/workspaceVerification';
import { waitForClusterOverlap } from './clusterOverlap/waitForClusterOverlap';

type DiscardParams = Readonly<{
  error: unknown;
}>;

type RunOnceParams = Readonly<{
  input: SendTurnInput;
  lease: TurnLease;
}>;

const NO_KNOWN_RUN = null;

const OPERATOR_SETTLE_WAIT_MS = 30_000;

const ALREADY_SENT: SendTurnResult = { blockedOverBudget: false, isAlreadySent: true };

export const sendTurn = (set: SetFn, get: GetFn) => {
  const runOnce = async ({ input: given, lease }: RunOnceParams): Promise<SendTurnResult> => {
    const input = handDelivery.withId({ input: given });
    await workspaceVerification.settled();
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
      releaseUnstartedTurn({
        set,
        get,
        sessionId: input.sessionId,
        agentId: startCtx.activeAgentId,
      });
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
    const { runId, resolvedAgentId, agentBefore, hasAdmission } = started.value;
    const releaseAdmission = async (): Promise<void> => {
      if (!hasAdmission) {
        return;
      }
      await releaseTurnAdmission({
        db: tauriDatabase,
        agentId: startCtx.activeAgentId,
        runId,
      }).catch((error: unknown) => console.warn('release the turn admission failed', error));
    };
    const closeThenDiscard = async ({ error }: DiscardParams): Promise<never> => {
      await closeUnspawnedRun({
        set,
        get,
        sessionId: input.sessionId,
        agentId: startCtx.activeAgentId,
        resolvedAgentId,
        agentBefore,
        runId,
        error,
      }).catch((closeError: unknown) =>
        get().reportError({
          recovery: CHECK_STATE,
          title: "Couldn't close the turn that never started",
          error: closeError,
          sessionId: input.sessionId,
        }),
      );
      return discardUnspawned({ error });
    };
    const promptCtx = { ...startCtx, ...started.value };
    const prompt = await buildTurnPrompt({ get, ctx: promptCtx }).catch((error: unknown) =>
      closeThenDiscard({ error }),
    );
    const spawnCtx = { ...promptCtx, ...prompt };
    const spawn = await buildTurnSpawn({ set, get, lease, ctx: spawnCtx }).catch((error: unknown) =>
      closeThenDiscard({ error }),
    );
    const ctx = { ...spawnCtx, ...spawn };
    const onSpawned = (): void => {
      if (cancelledRunIds.has(runId)) {
        void cancelTurn(runId).catch((error: unknown) =>
          console.warn('stopping the run that spawned after its stop failed', error),
        );
        return;
      }
      ctx.progress.hasSpawned = true;
      void releaseAdmission();
      input.onStarted?.();
    };
    try {
      if (!cancelledRunIds.has(runId)) {
        await readTurnStream({ set, get, ctx, onSpawned });
      }
      await finalizeTurnStream({ set, get, ctx });
    } catch (err) {
      const recovered = await recoverTurnFailure({ set, get, lease, ctx, err, runOnce });
      if (recovered !== null) {
        return recovered;
      }
    } finally {
      if (!ctx.progress.hasSpawned) {
        await releaseAdmission();
      }
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
    const childResult = await routeAutoChildTurn({ get, input });
    if (childResult !== null) {
      return childResult;
    }
    if (input.origin === 'operator' && input.agentId !== undefined) {
      await stopLingeringTurn({ agentId: input.agentId });
      await waitTurnSettledFor({ agentId: input.agentId, ms: OPERATOR_SETTLE_WAIT_MS });
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
        announceAgentTurn({ sessionId: input.sessionId, agentId: settledAgentId });
        watchStepEnd({ set, get, sessionId: input.sessionId, agentId: settledAgentId });
        void get().drainAgentQueue({ sessionId: input.sessionId, agentId: settledAgentId });
      }
    }
  };
  return run;
};
