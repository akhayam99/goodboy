import type { SessionId } from '@goodboy/types';
import { createLatestOnly, type LatestClaim } from './latestOnly';

type ClaimParams = {
  readonly sessionId: SessionId;
};

const PLAN_READS = createLatestOnly();
const ARTIFACT_READS = createLatestOnly();

export const sessionReads = {
  plans: ({ sessionId }: ClaimParams): LatestClaim => PLAN_READS.claim({ key: sessionId }),
  artifacts: ({ sessionId }: ClaimParams): LatestClaim => ARTIFACT_READS.claim({ key: sessionId }),
};
