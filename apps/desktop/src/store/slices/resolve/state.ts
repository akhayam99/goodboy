import type {
  AgentId,
  ResolveAttempt,
  ResolveBatch,
  ResolveCandidate,
  ResolveCandidateItem,
  ResolveCheckRun,
  ResolvePublication,
  ResolvePublicationPreview,
  ResolveQueueItemWithThread,
  ResolveSourceSnapshot,
  ResolveThread,
  ResolveUncapturedWork,
  SessionId,
} from '@goodboy/types';
import type { ThreadGitFacts } from './threadGitState';

export type ResolveCandidateWithItems = Readonly<{
  candidate: ResolveCandidate;
  items: ReadonlyArray<ResolveCandidateItem>;
}>;

export type ThreadRecheck = Readonly<{
  agentId: AgentId | null;
  error: string | null;
}>;

export type ResolveState = {
  readonly sessionResolveThreads: Readonly<Record<SessionId, ReadonlyArray<ResolveThread>>>;
  readonly sessionResolveAttempts: Readonly<Record<SessionId, ReadonlyArray<ResolveAttempt>>>;
  readonly sessionResolveBatches: Readonly<Record<SessionId, ReadonlyArray<ResolveBatch>>>;
  readonly sessionResolveParallelLimit: Readonly<Record<SessionId, number>>;
  readonly sessionResolveCandidates: Readonly<
    Record<SessionId, ReadonlyArray<ResolveCandidateWithItems>>
  >;
  readonly sessionResolveCheckRuns: Readonly<Record<SessionId, ReadonlyArray<ResolveCheckRun>>>;
  readonly sessionResolveQueueItems: Readonly<
    Record<SessionId, ReadonlyArray<ResolveQueueItemWithThread>>
  >;
  readonly sessionResolvePublications: Readonly<
    Record<SessionId, ReadonlyArray<ResolvePublication>>
  >;
  readonly sessionResolveUncapturedWork: Readonly<Record<SessionId, ResolveUncapturedWork | null>>;
  readonly sessionResolveSourceSnapshots: Readonly<
    Record<SessionId, Readonly<Record<string, ResolveSourceSnapshot>>>
  >;
  readonly activePublicationPreview: Readonly<Record<SessionId, ResolvePublicationPreview | null>>;
  readonly sessionThreadGit: Readonly<Record<SessionId, Readonly<Record<string, ThreadGitFacts>>>>;
  readonly sessionThreadRechecks: Readonly<
    Record<SessionId, Readonly<Record<string, ThreadRecheck>>>
  >;
  readonly threadFixDismissals: Readonly<
    Record<SessionId, Readonly<Record<string, ReadonlyArray<string>>>>
  >;
};

export const resolveInitialState: ResolveState = {
  sessionResolveThreads: {},
  sessionResolveAttempts: {},
  sessionResolveBatches: {},
  sessionResolveParallelLimit: {},
  sessionResolveCandidates: {},
  sessionResolveCheckRuns: {},
  sessionResolveQueueItems: {},
  sessionResolvePublications: {},
  sessionResolveUncapturedWork: {},
  sessionResolveSourceSnapshots: {},
  activePublicationPreview: {},
  sessionThreadGit: {},
  sessionThreadRechecks: {},
  threadFixDismissals: {},
};
