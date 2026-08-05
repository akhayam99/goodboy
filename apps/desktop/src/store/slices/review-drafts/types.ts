import type { PrReviewDraft } from '@goodboy/types';
import type { ReviewTarget } from './resolveReviewTarget';

export type PublishPrReviewVerdict = 'comment' | 'approve' | 'request_changes';

export type PublishPrReviewOpts = {
  readonly verdict: PublishPrReviewVerdict;
  readonly body: string;
  readonly target?: ReviewTarget;
};

export type PublishPrReviewResult = {
  readonly published: number;
  readonly stale: ReadonlyArray<PrReviewDraft>;
  readonly failed: ReadonlyArray<{ readonly draft: PrReviewDraft; readonly error: string }>;
  readonly mismatched: ReadonlyArray<PrReviewDraft>;
};

export type { GetFn, SetFn } from '../../slice-types';
