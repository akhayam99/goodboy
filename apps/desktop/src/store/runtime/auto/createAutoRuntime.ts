import { isAutoGateBlock } from '@goodboy/core';
import { getAutoTree, listAutoTreesToRecover, type AutoTree } from '@goodboy/db';
import type { AutoDelegationId } from '@goodboy/types';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import { advancePhase } from './advancePhase';
import { confirmDelegation, type ConfirmDelegationOutcome } from './confirmDelegation';
import { createOwnTurns } from './createOwnTurns';
import { deliverNext, type DeliverOutcome } from './deliver';
import { enforceDeadlines } from './enforceDeadlines';
import { expireStaleDecide } from './expireStaleDecide';
import { finishAttempt } from './finishAttempt';
import { joinReady } from './join';
import { launchChildren } from './launchChildren';
import type { AutoTurnEnded, ChildTurnEnded } from './ports';
import { recoverTree } from './recover';
import { publishAct, type PublishActParams } from './publishAct';
import { rerunChecks, type RerunChecksOutcome } from './rerunChecks';
import { retryBlockedTree, type RetryBlockedTreeOutcome } from './retryBlockedTree';
import { settleAutoTurn } from './settleAutoTurn';
import type { SleepParams } from './startDeliveredTurn';
import { stopTree, type StopTreeOutcome } from './stopTree';
import {
  submitUserMessage,
  type SubmitUserMessageOutcome,
  type SubmitUserMessageParams,
} from './submitUserMessage';
import type { AgentVerbContext } from './verbContext';

const MAX_DRIVE_PASSES = 25;
const DEFAULT_WATCH_POLLS = 3_600;

export type AutoRuntimeOptions = Readonly<{
  ctx: AgentVerbContext;
  onError: (error: unknown) => void;
  sleep?: (params: SleepParams) => Promise<void>;
  watchPolls?: number;
}>;

type ConfirmRuntimeParams = Readonly<{
  delegationId: AutoDelegationId;
  decision: 'confirm' | 'decline';
}>;

type SendNowRuntimeParams = Readonly<{
  treeId: AutoTree['id'];
  rowId: string;
}>;

export type AutoRuntime = Readonly<{
  ctx: AgentVerbContext;
  drive: (treeId: AutoTree['id']) => Promise<void>;
  onAutoTurnEnded: (ended: AutoTurnEnded) => void;
  onChildEnded: (ended: ChildTurnEnded) => void;
  stop: (treeId: AutoTree['id']) => Promise<StopTreeOutcome>;
  retry: (treeId: AutoTree['id']) => Promise<RetryBlockedTreeOutcome>;
  confirm: (params: ConfirmRuntimeParams) => Promise<ConfirmDelegationOutcome>;
  rerunChecks: (delegationId: AutoDelegationId) => Promise<RerunChecksOutcome>;
  publish: (params: Omit<PublishActParams, 'ctx'>) => ReturnType<typeof publishAct>;
  say: (params: Omit<SubmitUserMessageParams, 'ctx'>) => Promise<SubmitUserMessageOutcome>;
  sendNow: (params: SendNowRuntimeParams) => Promise<DeliverOutcome>;
  recover: (treeId: AutoTree['id']) => Promise<boolean>;
  recoverAll: () => Promise<void>;
  settled: () => Promise<void>;
}>;

const realSleep = ({ ms }: SleepParams): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const createAutoRuntime = ({
  ctx,
  onError,
  sleep = realSleep,
  watchPolls = DEFAULT_WATCH_POLLS,
}: AutoRuntimeOptions): AutoRuntime => {
  const queue = createKeyedQueue();
  const inflight = new Set<Promise<void>>();
  const ownTurns = createOwnTurns();
  const watchedSinceMs = ctx.now();
  const track = (work: Promise<void>): void => {
    const tracked = work.catch(onError).finally(() => {
      inflight.delete(tracked);
    });
    inflight.add(tracked);
  };
  const driveOnce = async (treeId: AutoTree['id']): Promise<boolean> => {
    const hasExpired = await enforceDeadlines({ ctx, treeId, watchedSinceMs });
    const hasStaleDecide = await expireStaleDecide({ ctx, treeId, ownTurns });
    const joined = await joinReady({ ctx, treeId });
    const hasAdvanced = await advancePhase({ ctx, treeId });
    const launched = await launchChildren({ ctx, treeId, onChildEnded: runtime.onChildEnded });
    if (launched.delegationIds.length > 0) {
      track(launched.done.then(() => runtime.drive(treeId)));
    }
    const delivered = await deliverNext({
      ctx,
      treeId,
      onEnded: runtime.onAutoTurnEnded,
      ownTurns,
    });
    return (
      hasExpired ||
      hasStaleDecide ||
      joined.kind === 'joined' ||
      hasAdvanced ||
      launched.delegationIds.length > 0 ||
      delivered.kind === 'delivered' ||
      delivered.kind === 'accept_pending' ||
      delivered.kind === 'blocked'
    );
  };
  const drive = (treeId: AutoTree['id']): Promise<void> =>
    queue.run({
      key: treeId,
      task: async () => {
        for (let pass = 0; pass < MAX_DRIVE_PASSES; pass += 1) {
          if (!(await driveOnce(treeId))) {
            return;
          }
        }
      },
    });
  const recover = async (treeId: AutoTree['id']): Promise<boolean> => {
    const outcome = await recoverTree({ ctx, treeId, sleep, maxPolls: watchPolls, ownTurns });
    const tree = await getAutoTree({ db: ctx.db, treeId });
    if (tree?.phase === 'blocked' && !isAutoGateBlock({ reason: tree.blockedReason })) {
      await retryBlockedTree({ ctx, treeId });
    }
    if (outcome.kind === 'recovered') {
      for (const watcher of outcome.watchers) {
        track(watcher.then(() => runtime.drive(treeId)));
      }
    }
    await drive(treeId);
    return outcome.kind === 'recovered';
  };
  const runtime: AutoRuntime = {
    ctx,
    drive,
    onAutoTurnEnded: (ended) => {
      track(
        settleAutoTurn({ ctx, ended })
          .finally(() => {
            ownTurns.end({ runId: ended.runId });
          })
          .then(() => drive(ended.treeId)),
      );
    },
    onChildEnded: (ended) => {
      track(finishAttempt({ ctx, ended }).then(() => drive(ended.treeId)));
    },
    stop: async (treeId) => {
      const outcome = await stopTree({ ctx, treeId });
      await drive(treeId);
      return outcome;
    },
    retry: async (treeId) => {
      const outcome = await retryBlockedTree({ ctx, treeId });
      if (outcome.kind === 'retried') {
        await drive(treeId);
      }
      return outcome;
    },
    confirm: async ({ delegationId, decision }) => {
      const outcome = await confirmDelegation({ ctx, delegationId, decision });
      return outcome;
    },
    rerunChecks: (delegationId) => rerunChecks({ ctx, delegationId }),
    publish: (params) => publishAct({ ctx, ...params }),
    say: async (params) => {
      const outcome = await submitUserMessage({ ctx, ...params });
      if (outcome.kind === 'queued') {
        await retryBlockedTree({ ctx, treeId: params.treeId });
        await drive(params.treeId);
      }
      return outcome;
    },
    sendNow: async ({ treeId, rowId }) => {
      const outcome = await queue.run({
        key: treeId,
        task: () =>
          deliverNext({
            ctx,
            treeId,
            onEnded: runtime.onAutoTurnEnded,
            ownTurns,
            sendNowId: rowId,
          }),
      });
      await drive(treeId);
      return outcome;
    },
    recover,
    recoverAll: async () => {
      const trees = await listAutoTreesToRecover({ db: ctx.db });
      await Promise.all(trees.map((tree) => recover(tree.id)));
    },
    settled: async () => {
      while (inflight.size > 0) {
        await Promise.all([...inflight]);
      }
    },
  };
  return runtime;
};
