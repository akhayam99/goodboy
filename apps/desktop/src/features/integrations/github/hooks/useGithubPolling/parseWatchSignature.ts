import { brandId, type MountId, type PullRequestChecks, type SessionId } from '@goodboy/types';
import type { WatchFact } from './watchFacts';

type Params = {
  readonly signature: string;
};

type ChecksParams = {
  readonly value: string;
};

const watchChecksOf = ({ value }: ChecksParams): PullRequestChecks =>
  value === 'pending' || value === 'success' || value === 'failure' ? value : null;

export const parseWatchSignature = ({ signature }: Params): ReadonlyArray<WatchFact> => {
  const facts: Array<WatchFact> = [];
  for (const entry of signature.split(';')) {
    const [sessionId, mountId, prNumber, headSha, checks] = entry.split('|');
    if (
      sessionId === undefined ||
      mountId === undefined ||
      prNumber === undefined ||
      headSha === undefined ||
      checks === undefined
    ) {
      continue;
    }
    facts.push({
      sessionId: brandId<SessionId>({ value: sessionId }),
      mountId: brandId<MountId>({ value: mountId }),
      prNumber: Number(prNumber),
      headSha,
      checks: watchChecksOf({ value: checks }),
    });
  }
  return facts;
};
