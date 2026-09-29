import { cancelPublication } from './cancelPublication';
import { drainResolveQueue } from './drainResolveQueue';
import { preparePublication } from './preparePublication';
import { publishConversations } from './publishConversations';
import { retryPublication } from './retryPublication';
import { drainResolveWorktree } from './drainResolveWorktree';
import { loadResolveSession } from './loadResolveSession';
import { persistResolveTurn } from './persistResolveTurn';
import { recordResolveAttempt } from './recordResolveAttempt';
import { recordResolvePhase } from './recordResolvePhase';
import { reconcileResolveDrains } from './reconcileResolveDrains';
import { updateResolveThreads } from './updateResolveThreads';
import { updateResolveThread } from './updateResolveThread';
import { acceptResolveQueueItem } from './acceptResolveQueueItem';
import { refuseResolveQueueItem } from './refuseResolveQueueItem';
import { beginResolveCandidate } from './beginResolveCandidate';
import { captureResolveCandidate } from './captureResolveCandidate';
import { runResolveCheck } from './runResolveCheck';
import { recoverUncapturedResolveWork } from './recoverUncapturedResolveWork';
import { deferResolveQueueItem } from './deferResolveQueueItem';
import { reopenResolveQueueItem } from './reopenResolveQueueItem';
import { takeUpResolveQueueItem } from './takeUpResolveQueueItem';
import { ensureReviewThread } from './ensureReviewThread';
import { materializeReviewThreads } from './materializeReviewThreads';
import { syncNoteThreads } from './syncNoteThreads';
import { closeResolvedNote } from './closeResolvedNote';
import { resolveWithoutReply } from './resolveWithoutReply';
import { settleResolveSourceChange } from './settleResolveSourceChange';
import { syncSourceSnapshots } from './syncSourceSnapshots';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import type {
  ResolveActions,
  BatchUpdateParams,
  AttemptParams,
  DrainParams,
  PhaseParams,
  PreparePublicationParams,
  PublishParams,
  SessionParams,
  SliceParams,
  TurnParams,
  UpdateParams,
  WorktreeDrainParams,
  ItemParams,
  ThreadParams,
  ItemRevisionParams,
  CandidateBeginParams,
  CandidateCaptureParams,
  CheckRunParams,
  EnsureReviewThreadParams,
  MaterializeParams,
  SettleSourceChangeParams,
  SourceSnapshotsParams,
} from './types';

export const createResolveSlice = ({ set, get }: SliceParams): ResolveActions => {
  const writes = createKeyedQueue();
  type WriteParams<T> = SessionParams & { readonly run: () => Promise<T> };
  const serialize = <T>({ sessionId, run }: WriteParams<T>): Promise<T> =>
    writes.run({ key: sessionId, task: run });
  return {
    acceptResolveQueueItem: (params: ItemRevisionParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => acceptResolveQueueItem({ set, get, ...params }),
      }),
    refuseResolveQueueItem: (params: ItemRevisionParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => refuseResolveQueueItem({ set, get, ...params }),
      }),
    resolveWithoutReply: (params: ItemParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => resolveWithoutReply({ set, get, ...params }),
      }),
    deferResolveQueueItem: (params: ItemParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => deferResolveQueueItem({ set, get, ...params }),
      }),
    takeUpResolveQueueItem: (params: ItemParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => takeUpResolveQueueItem({ set, get, ...params }),
      }),
    reopenResolveQueueItem: (params: Omit<ItemRevisionParams, 'reply'>) =>
      serialize({
        sessionId: params.sessionId,
        run: () => reopenResolveQueueItem({ set, get, ...params }),
      }),
    updateResolveThreads: (params: BatchUpdateParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => updateResolveThreads({ set, get, ...params }),
      }),
    loadResolveSession: (params: SessionParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => loadResolveSession({ set, get, ...params }),
      }),
    persistResolveTurn: (params: TurnParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => persistResolveTurn({ set, get, ...params }),
      }),
    recordResolveAttempt: (params: AttemptParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => recordResolveAttempt({ set, get, ...params }),
      }),
    recordResolvePhase: (params: PhaseParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => recordResolvePhase({ set, get, ...params }),
      }),
    beginResolveCandidate: (params: CandidateBeginParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => beginResolveCandidate({ set, get, ...params }),
      }),
    captureResolveCandidate: (params: CandidateCaptureParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => captureResolveCandidate({ set, get, ...params }),
      }),
    runResolveCheck: (params: CheckRunParams) => runResolveCheck({ set, get, ...params }),
    recoverUncapturedResolveWork: (params: SessionParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => recoverUncapturedResolveWork({ set, get, ...params }),
      }),
    drainResolveQueue: (params: DrainParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => drainResolveQueue({ set, get, ...params }),
      }),
    drainResolveWorktree: (params: WorktreeDrainParams) =>
      drainResolveWorktree({ set, get, ...params }),
    reconcileResolveDrains: () =>
      reconcileResolveDrains({
        set,
        get,
        runInSession: ({ sessionId, task }) => serialize({ sessionId, run: task }),
      }),
    updateResolveThread: (params: UpdateParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => updateResolveThread({ set, get, ...params }),
      }),
    ensureReviewThread: (params: EnsureReviewThreadParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => ensureReviewThread({ set, get, ...params }),
      }),
    syncNoteThreads: (params: SessionParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => syncNoteThreads({ set, get, ...params }),
      }),
    closeResolvedNote: (params: ThreadParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => closeResolvedNote({ set, get, ...params }),
      }),
    syncSourceSnapshots: (params: SourceSnapshotsParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => syncSourceSnapshots({ set, ...params }),
      }),
    settleResolveSourceChange: (params: SettleSourceChangeParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => settleResolveSourceChange({ set, ...params }),
      }),
    materializeReviewThreads: (params: MaterializeParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => materializeReviewThreads({ set, get, ...params }),
      }),
    preparePublication: (params: PreparePublicationParams) =>
      preparePublication({ set, get, ...params }),
    publishConversations: (params: PublishParams) => publishConversations({ set, get, ...params }),
    retryPublication: (params: SessionParams) => retryPublication({ set, get, ...params }),
    cancelPublication: (params: PublishParams) => cancelPublication({ set, get, ...params }),
  };
};
