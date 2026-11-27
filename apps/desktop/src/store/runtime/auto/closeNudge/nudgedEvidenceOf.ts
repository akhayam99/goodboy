import { storedResultOf, type DelegationResultV1 } from '@goodboy/core/auto';
import { listAutoAttemptsOfDelegation, type AutoAttempt, type Database } from '@goodboy/db';
import { isRecord } from '@goodboy/types/helpers';

type NudgedEvidenceParams = Readonly<{
  db: Database;
  attempt: AutoAttempt;
}>;

export type NudgedEvidence = Pick<DelegationResultV1, 'verified' | 'artifacts'>;

export const nudgedEvidenceOf = async ({
  db,
  attempt,
}: NudgedEvidenceParams): Promise<NudgedEvidence | null> => {
  const attempts = await listAutoAttemptsOfDelegation({ db, delegationId: attempt.delegationId });
  const nudged = attempts
    .filter((earlier) => earlier.ordinal < attempt.ordinal)
    .sort((left, right) => right.ordinal - left.ordinal)[0];
  const snapshot = nudged?.resultSnapshot;
  const envelope = isRecord(snapshot) ? storedResultOf({ value: snapshot['envelope'] }) : null;
  if (envelope === null) {
    return null;
  }
  return { verified: envelope.verified, artifacts: envelope.artifacts };
};
