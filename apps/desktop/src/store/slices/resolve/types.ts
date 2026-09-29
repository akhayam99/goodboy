import type {
  Agent,
  AgentId,
  MountTargetSnapshot,
  PrComment,
  ProjectId,
  ResolveAttemptPhase,
  ResolveBatch,
  ResolveCheckBreadth,
  ResolveLaunchChoice,
  ResolvePublicationDrift,
  ResolvePublicationPreview,
  ResolveSourceKind,
  ResolveThread,
  ResolveUncapturedWork,
  SessionId,
} from '@goodboy/types';
import type { PublishConversationsResult } from './publishConversations';
import type { ResolveCandidateMode } from './resolveCandidateMode';
import type { ResolveCheckPair } from './runResolveCheck';
import type { GetFn, SetFn } from '../../slice-types';

export type { GetFn, SetFn } from '../../slice-types';
export type SliceParams = { readonly set: SetFn; readonly get: GetFn };
export type SessionParams = { readonly sessionId: SessionId };
export type ItemParams = SessionParams & { readonly itemId: string };
export type ItemRevisionParams = ItemParams & {
  readonly revision: number;
  readonly reply: string;
};
export type TurnParams = SessionParams & {
  readonly agent: Agent;
  readonly assistantText: string;
  readonly isCandidate?: boolean;
  readonly attemptId?: string;
};
export type AttemptParams = SessionParams & {
  readonly agent: Agent;
  readonly mountTarget: MountTargetSnapshot | null;
  readonly provider: string;
  readonly model: string;
  readonly effort: string | null;
  readonly instructions: string | null;
  readonly phase: 'queued' | 'running';
  readonly threadIds?: ReadonlyArray<string>;
  readonly candidateMode?: ResolveCandidateMode;
  readonly batch?: ResolveAttemptBatch;
};
export type ResolveAttemptBatch = {
  readonly batchId: string;
  readonly launchChoice: ResolveLaunchChoice;
};
export type CandidateBeginParams = SessionParams & {
  readonly attemptId: string;
  readonly mountTarget: MountTargetSnapshot | null;
  readonly baseSha?: string;
};
export type CandidateCaptureParams = SessionParams & {
  readonly attemptId: string;
  readonly threadIds: ReadonlyArray<string>;
};
export type CheckRunParams = SessionParams & {
  readonly candidateId: string;
  readonly command: string;
  readonly name: string;
  readonly testIdentity: string | null;
  readonly breadth: ResolveCheckBreadth;
};
export type PhaseParams = SessionParams & {
  readonly agentId: AgentId;
  readonly attemptId?: string;
  readonly phase: ResolveAttemptPhase;
  readonly error?: string | null;
  readonly isCleanExit?: boolean;
};
export type DrainParams = SessionParams & {
  readonly endedAttemptId?: string;
  readonly worktreePath?: string;
};
export type WorktreeDrainParams = {
  readonly worktreePath: string;
};
export type UpdateParams = SessionParams & {
  readonly threadId: string;
  readonly patch: Partial<
    Omit<ResolveThread, 'id' | 'sessionId' | 'threadId' | 'revision' | 'createdAt'>
  >;
  readonly initialPatch?: UpdateParams['patch'];
  readonly revision?: number;
  readonly prNumber?: number | null;
};

export type ResolveUpdates = ReadonlyArray<Pick<UpdateParams, 'threadId' | 'revision' | 'patch'>>;
export type ResolveUpdatesParams = { readonly rows: ReadonlyArray<ResolveThread> };
export type BatchUpdateParams = SessionParams & {
  readonly updates: ResolveUpdates | ((params: ResolveUpdatesParams) => ResolveUpdates);
};

export type PreparePublicationParams = SessionParams & {
  readonly threadIds?: ReadonlyArray<string>;
  readonly scopeId?: string;
  readonly drift?: ReadonlyArray<ResolvePublicationDrift>;
};
export type PublishParams = SessionParams & {
  readonly publicationId: string;
  readonly scopeId?: string;
};

export type ThreadParams = SessionParams & { readonly threadId: string };

export type EnsureReviewThreadParams = SessionParams & {
  readonly threadId: string;
  readonly prNumber: number;
  readonly isCancelled?: () => boolean;
};

export type MaterializeParams = SessionParams & {
  readonly prNumber: number;
  readonly projectId: ProjectId | null;
  readonly comments: ReadonlyArray<PrComment>;
  readonly sourceKind?: ResolveSourceKind;
};

export type EnsureReviewThreadResult = 'existing' | 'created' | 'missing' | 'closed' | 'cancelled';

export type ResolveActions = {
  readonly acceptResolveQueueItem: (params: ItemRevisionParams) => Promise<void>;
  readonly refuseResolveQueueItem: (params: ItemRevisionParams) => Promise<void>;
  readonly resolveWithoutReply: (params: ItemParams) => Promise<void>;
  readonly deferResolveQueueItem: (params: ItemParams) => Promise<void>;
  readonly takeUpResolveQueueItem: (params: ItemParams) => Promise<void>;
  readonly reopenResolveQueueItem: (params: Omit<ItemRevisionParams, 'reply'>) => Promise<void>;
  readonly preparePublication: (
    params: PreparePublicationParams,
  ) => Promise<ResolvePublicationPreview>;
  readonly publishConversations: (params: PublishParams) => Promise<PublishConversationsResult>;
  readonly retryPublication: (params: SessionParams) => Promise<ResolvePublicationPreview>;
  readonly cancelPublication: (params: PublishParams) => Promise<void>;
  readonly updateResolveThreads: (params: BatchUpdateParams) => Promise<void>;
  readonly loadResolveSession: (params: SessionParams) => Promise<void>;
  readonly persistResolveTurn: (params: TurnParams) => Promise<void>;
  readonly recordResolveAttempt: (params: AttemptParams) => Promise<string>;
  readonly recordResolvePhase: (params: PhaseParams) => Promise<void>;
  readonly beginResolveCandidate: (params: CandidateBeginParams) => Promise<void>;
  readonly captureResolveCandidate: (params: CandidateCaptureParams) => Promise<string | null>;
  readonly runResolveCheck: (params: CheckRunParams) => Promise<ResolveCheckPair>;
  readonly recoverUncapturedResolveWork: (
    params: SessionParams,
  ) => Promise<ResolveUncapturedWork | null>;
  readonly drainResolveQueue: (params: DrainParams) => Promise<void>;
  readonly drainResolveWorktree: (params: WorktreeDrainParams) => Promise<void>;
  readonly reconcileResolveDrains: () => Promise<void>;
  readonly updateResolveThread: (params: UpdateParams) => Promise<boolean>;
  readonly ensureReviewThread: (
    params: EnsureReviewThreadParams,
  ) => Promise<EnsureReviewThreadResult>;
  readonly materializeReviewThreads: (params: MaterializeParams) => Promise<number>;
  readonly syncNoteThreads: (params: SessionParams) => Promise<number>;
  readonly closeResolvedNote: (params: ThreadParams) => Promise<void>;
  readonly createResolveBatch: (params: CreateBatchParams) => Promise<ResolveBatch>;
  readonly setResolveParallelLimit: (params: ParallelLimitParams) => Promise<void>;
};
export type CreateBatchParams = SessionParams & {
  readonly threadIds: ReadonlyArray<string>;
  readonly launchChoice: ResolveLaunchChoice;
};
export type ParallelLimitParams = SessionParams & { readonly limit: number };
