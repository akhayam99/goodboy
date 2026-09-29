import type {
  IsoDateTime,
  MountId,
  PrComment,
  ProjectId,
  ResolveSourceKind,
  SessionId,
} from '@goodboy/types';
import type { ReviewSourceCapabilities } from '@goodboy/core';

export type { GetFn, SetFn } from '../../slice-types';

export const LOCAL_SOURCE_KEY = 'local';

export type ReviewSourceEntry = Readonly<{
  key: string;
  kind: ResolveSourceKind;
  mountId: MountId | null;
  projectId: ProjectId | null;
  number: number | null;
  label: string;
  url: string | null;
  openCount: number | null;
}>;

export type ActiveReviewSource = Readonly<{
  kind: 'github' | 'gitlab';
  entry: ReviewSourceEntry;
  mountId: MountId | null;
  projectId: ProjectId | null;
  prNumber: number;
  url: string | null;
  repo: string | null;
  headBranch: string | null;
  comments: ReadonlyArray<PrComment>;
  hasDetail: boolean;
  isLoading: boolean;
  error: string | null;
  fetchedAt: IsoDateTime | null;
  capabilities: ReviewSourceCapabilities;
}>;

export type ReviewSourceThreads = Readonly<{
  comments: ReadonlyArray<PrComment>;
  fetchedAt: IsoDateTime | null;
  loading: boolean;
  error: string | null;
}>;

export type SelectReviewSourceParams = Readonly<{
  sessionId: SessionId;
  key: string;
}>;

export type RefreshReviewSourceParams = Readonly<{
  sessionId: SessionId;
  force?: boolean;
  silent?: boolean;
}>;

export type ReviewSourceSlice = Readonly<{
  selectReviewSource: (params: SelectReviewSourceParams) => Promise<void>;
  refreshReviewSource: (params: RefreshReviewSourceParams) => Promise<void>;
}>;
