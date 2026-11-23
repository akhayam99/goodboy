import type { ReactNode } from 'react';
import type { ReviewSourceKind } from '@goodboy/core/review-source';
import type { PrCheckRun, SessionId } from '@goodboy/types';

export type PrChecksSlotParams = {
  readonly sessionId: SessionId;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly fallbackUrl: string;
  readonly host: ReviewSourceKind;
  readonly isLoading: boolean;
};

export type RenderPrChecks = (params: PrChecksSlotParams) => ReactNode;
