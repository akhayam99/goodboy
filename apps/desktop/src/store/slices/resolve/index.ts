import type { AgentId } from '@goodboy/types';
import { cancelPublication } from './cancelPublication';
import { answerQuestions } from './answerQuestions';
import { continueResolveThreads } from './continueResolveThreads';
import { dropLaneCandidate } from './dropLaneCandidate';
import { drainResolveQueue } from './drainResolveQueue';
import { rebuildTakenUpFix } from './rebuildTakenUpFix';
import { reconcileResolveLane } from './reconcileResolveLane';
import { stopResolveLane } from './stopResolveLane';
import { preparePublication } from './preparePublication';
import { publishConversations } from './publishConversations';
import { retryCouldntFix } from './retryCouldntFix';
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
import { createResolveBatch } from './resolveBatches';
import { settleItemAnswered } from './settleItemAnswered';
import { dismissThreadFix, refreshThreadGitState } from './refreshThreadGitState';
import { publishThreadNow } from './publishThreadNow';
import { reconcileHandReplies } from './reconcileHandReplies';
import { switchToReplyOnly } from './switchToReplyOnly';
import { recheckThread, settleThreadRecheck } from './recheckThread';
import { resolveThreadOnRemote } from './resolveThreadOnRemote';
import { settleResolveSourceChange } from './settleResolveSourceChange';
import { syncSourceSnapshots } from './syncSourceSnapshots';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import type {
  ResolveActions,
  BatchUpdateParams,
  AnswerQuestionsParams,
  AttemptParams,
  ContinueThreadsParams,
  RetryCouldntFixParams,
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
  CreateBatchParams,
  SettleSourceChangeParams,
  SourceSnapshotsParams,
} from './types';

export const createResolveSlice = ({ set, get }: SliceParams): ResolveActions => {
  const writes = createKeyedQueue();
  type WriteParams<T> = SessionParams & { readonly run: () => Promise<T> };
  const serialize = <T>({ sessionId, run }: WriteParams<T>): Promise<T> =>
    writes.run({ key: sessionId, task: run });
  const reconciles = createKeyedQueue();
  const reconcileLane = ({ sessionId }: SessionParams): Promise<void> =>
    reconciles.run({
      key: sessionId,
      task: () => reconcileResolveLane({ set, get, sessionId }),
    });
  const settleLane = async <T>({ sessionId, run }: WriteParams<T>): Promise<T> => {
    const result = await serialize({ sessionId, run });
    await reconcileLane({ sessionId }).catch(() => undefined);
    return result;
  };
  return {
    acceptResolveQueueItem: async (params: ItemRevisionParams) => {
      try {
        await serialize({
          sessionId: params.sessionId,
          run: () => acceptResolveQueueItem({ set, get, ...params }),
        });
      } finally {
        await reconcileLane({ sessionId: params.sessionId }).catch(() => undefined);
      }
    },
    refuseResolveQueueItem: (params: ItemRevisionParams) =>
      settleLane({
        sessionId: params.sessionId,
        run: async () => {
          await refuseResolveQueueItem({ set, get, ...params });
          await dropLaneCandidate({ set, sessionId: params.sessionId, itemId: params.itemId });
        },
      }),
    resolveWithoutReply: (params: ItemParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => resolveWithoutReply({ set, get, ...params }),
      }),
    answerItemWithoutFix: (
      params: ItemParams & { readonly reply: string; readonly allowIntegrated?: boolean },
    ) =>
      serialize({
        sessionId: params.sessionId,
        run: () => settleItemAnswered({ set, get, ...params }),
      }),
    refreshThreadGitState: (params: SessionParams) =>
      refreshThreadGitState({ set, get, ...params }),
    dismissThreadFix: (params: ThreadParams & { readonly sha: string }) =>
      dismissThreadFix({ set, get, ...params }),
    replyAndResolveThread: (params: ThreadParams & { readonly reply?: string }) =>
      resolveThreadOnRemote({ set, get, ...params, mode: 'reply' }),
    publishThreadNow: (params: ThreadParams) => publishThreadNow({ get, ...params }),
    reconcileHandReplies: (params: SourceSnapshotsParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => reconcileHandReplies({ set, get, ...params }),
      }),
    switchToReplyOnly: (params: ThreadParams) =>
      settleLane({
        sessionId: params.sessionId,
        run: () => switchToReplyOnly({ set, get, ...params }),
      }),
    recheckThread: (params: ThreadParams) => recheckThread({ set, get, ...params }),
    settleThreadRecheck: (
      params: SessionParams & {
        readonly agentId: AgentId;
        readonly assistantText: string;
        readonly didAgentDie?: boolean;
      },
    ) => settleThreadRecheck({ set, get, ...params }),
    resolveThreadOnly: (params: ThreadParams) =>
      resolveThreadOnRemote({ set, get, ...params, mode: 'resolve_only' }),
    deferResolveQueueItem: (params: ItemParams) =>
      settleLane({
        sessionId: params.sessionId,
        run: async () => {
          await deferResolveQueueItem({ set, get, ...params });
          await dropLaneCandidate({ set, ...params });
        },
      }),
    takeUpResolveQueueItem: async (params: ItemParams) => {
      await serialize({
        sessionId: params.sessionId,
        run: () => takeUpResolveQueueItem({ set, get, ...params }),
      });
      await rebuildTakenUpFix({ set, get, ...params }).catch(() => undefined);
    },
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
      settleLane({
        sessionId: params.sessionId,
        run: () => loadResolveSession({ set, get, ...params }),
      }),
    persistResolveTurn: (params: TurnParams) =>
      settleLane({
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
    stopResolveLane: (params: SessionParams & { readonly worktreePath: string }) =>
      stopResolveLane({ get, ...params }),
    reconcileResolveLane: (params: SessionParams) => reconcileLane(params),
    runResolveCheck: (params: CheckRunParams) => runResolveCheck({ set, get, ...params }),
    recoverUncapturedResolveWork: (params: SessionParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => recoverUncapturedResolveWork({ set, get, ...params }),
      }),
    retryCouldntFix: (params: RetryCouldntFixParams) => retryCouldntFix({ get, ...params }),
    answerQuestions: async (params: AnswerQuestionsParams) => {
      await answerQuestions({ get, ...params });
      set((current) => ({
        sessionResolveAnswers: {
          ...current.sessionResolveAnswers,
          [params.sessionId]: {
            ...current.sessionResolveAnswers[params.sessionId],
            ...Object.fromEntries(
              params.answers
                .filter((item) => item.answer.trim() !== '')
                .map((item) => [item.threadId, item.answer.trim()]),
            ),
          },
        },
      }));
    },
    continueResolveThreads: (params: ContinueThreadsParams) =>
      continueResolveThreads({ get, ...params }),
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
        run: () => settleResolveSourceChange({ set, get, ...params }),
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
    createResolveBatch: (params: CreateBatchParams) =>
      serialize({
        sessionId: params.sessionId,
        run: () => createResolveBatch({ set, get, ...params }),
      }),
  };
};
