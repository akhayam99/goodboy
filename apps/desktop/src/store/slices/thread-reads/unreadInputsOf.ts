import type { MountId, PrComment, ProjectId, ResolveThread, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { activeReviewSourceOf, selectedReviewEntryOf } from '../review-source/activeReviewSource';
import type { ReviewSourceEntry } from '../review-source/types';
import { viewerIdentityOf } from './viewerIdentityOf';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export type UnreadInputs = {
  readonly threads: ReadonlyArray<ResolveThread>;
  readonly reads: Readonly<Record<string, number>> | undefined;
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly entryKind: ReviewSourceEntry['kind'] | null;
  readonly entryProjectId: ProjectId | null;
  readonly entryNumber: number | null;
  readonly identityKey: string | null;
  readonly fetchedAtMs: number | null;
};

const NO_THREADS: ReadonlyArray<ResolveThread> = [];

export const unreadInputsOf = ({ state, sessionId, mountId }: Params): UnreadInputs => {
  const entry = selectedReviewEntryOf({ state, sessionId, mountId });
  const source = activeReviewSourceOf({ state, sessionId, mountId });
  const identity = viewerIdentityOf({ state, kind: entry?.kind ?? 'github' });
  const fetchedAt = source?.fetchedAt ?? null;
  return {
    threads: state.sessionResolveThreads?.[sessionId] ?? NO_THREADS,
    reads: state.sessionThreadReads?.[sessionId],
    comments: source?.hasDetail === true ? source.comments : null,
    entryKind: entry?.kind ?? null,
    entryProjectId: entry?.projectId ?? null,
    entryNumber: entry?.number ?? null,
    identityKey: identity === null ? null : [...identity].sort().join('\n'),
    fetchedAtMs: fetchedAt === null ? null : Date.parse(fetchedAt),
  };
};
