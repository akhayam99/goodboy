import type { IsoDateTime, SessionId } from './ids';

export type ReviewablePrProvider = 'github' | 'gitlab';

export type ReviewDraftSide = 'new' | 'old';

export type ReviewDraftStatus = 'draft' | 'published';

export type ReviewDraftOrigin = 'agent' | 'user';

export type PrReviewDraft = {
  id: string;
  sessionId: SessionId;
  provider: ReviewablePrProvider;
  repo: string;
  prNumber: number;
  path: string;
  line: number;
  startLine: number | null;
  side: ReviewDraftSide;
  body: string;
  status: ReviewDraftStatus;
  stale: boolean;
  origin: ReviewDraftOrigin;
  createdAt: IsoDateTime;
};
