import type { PrReviewDraft } from '@goodboy/types';

export type PublishPrReviewVerdict = 'comment' | 'approve' | 'request_changes';

export type PublishPrReviewResult = {
  readonly published: number;
  readonly stale: ReadonlyArray<PrReviewDraft>;
  readonly failed: ReadonlyArray<{ readonly draft: PrReviewDraft; readonly error: string }>;
};

export type { GetFn, SetFn } from '../../slice-types';
