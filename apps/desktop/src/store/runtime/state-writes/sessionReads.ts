import type { SessionId } from '@goodboy/types';
import { createLatestOnly, type LatestClaim } from './latestOnly';

type ClaimParams = {
  readonly sessionId: SessionId;
};

const PLAN_READS = createLatestOnly();
const ARTIFACT_READS = createLatestOnly();
const AGENT_READS = createLatestOnly();
const OPENS = createLatestOnly();
const OPEN_KEY = 'open';

export const sessionReads = {
  agents: ({ sessionId }: ClaimParams): LatestClaim => AGENT_READS.claim({ key: sessionId }),
  open: (): LatestClaim => OPENS.claim({ key: OPEN_KEY }),
  plans: ({ sessionId }: ClaimParams): LatestClaim => PLAN_READS.claim({ key: sessionId }),
  artifacts: ({ sessionId }: ClaimParams): LatestClaim => ARTIFACT_READS.claim({ key: sessionId }),
};
