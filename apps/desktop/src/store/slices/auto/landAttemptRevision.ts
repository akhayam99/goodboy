import {
  getAutoAttempt,
  getAutoDelegation,
  type AutoAttempt,
  type AutoDelegation,
} from '@goodboy/db';
import { brandId, type ArtifactId } from '@goodboy/types';
import type { FailReviseParams } from './failRevise';
import type { LandRevisionOutcome } from './landRevision';
import type { AgentVerbContext } from './verbContext';

export type RevisionLanding = Readonly<{
  title: string;
  sourceText: string;
  metadata: Readonly<Record<string, unknown>>;
  ask: string | null;
  sourceTurnId: string | null;
}>;

export type LandAttemptRevisionParams = Readonly<{
  ctx: AgentVerbContext;
  delegation: AutoDelegation;
  attempt: AutoAttempt;
  generation: number;
}>;

export type LandAttemptRevisionOutcome =
  | Readonly<{ kind: 'landed' | 'already_landed'; revision: number }>
  | Readonly<{ kind: 'failed'; reason: FailReviseParams['reason'] }>
  | Readonly<{ kind: 'skipped' }>;

type RecordValue = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type SnapshotParams = {
  readonly attempt: AutoAttempt;
};

const landingOf = ({ attempt }: SnapshotParams): RevisionLanding | null => {
  const snapshot = attempt.resultSnapshot;
  if (!isRecord(snapshot)) {
    return null;
  }
  const landing = snapshot['landing'];
  if (!isRecord(landing)) {
    return null;
  }
  const title = landing['title'];
  const sourceText = landing['sourceText'];
  const metadata = landing['metadata'];
  const ask = landing['ask'];
  const sourceTurnId = landing['sourceTurnId'];
  if (typeof title !== 'string' || typeof sourceText !== 'string' || !isRecord(metadata)) {
    return null;
  }
  return {
    title,
    sourceText,
    metadata,
    ask: typeof ask === 'string' ? ask : null,
    sourceTurnId: typeof sourceTurnId === 'string' ? sourceTurnId : null,
  };
};

type EnvelopeParams = {
  readonly attempt: AutoAttempt;
};

export const envelopeOf = ({ attempt }: EnvelopeParams): RecordValue | null => {
  const snapshot = attempt.resultSnapshot;
  if (!isRecord(snapshot)) {
    return null;
  }
  const envelope = snapshot['envelope'];
  return isRecord(envelope) ? envelope : null;
};

type FailureParams = {
  readonly outcome: Extract<LandRevisionOutcome, { kind: 'dropped' }>;
};

const failureOf = ({ outcome }: FailureParams): FailReviseParams['reason'] | null =>
  outcome.reason === 'stale_base' ? 'stale_base' : null;

export const landAttemptRevision = async ({
  ctx,
  delegation,
  attempt,
  generation,
}: LandAttemptRevisionParams): Promise<LandAttemptRevisionOutcome> => {
  const landing = landingOf({ attempt });
  const envelope = envelopeOf({ attempt });
  const artifactId = delegation.reviseOf;
  const baseRevision = delegation.baseRevision;
  if (landing === null || envelope === null || artifactId === null || baseRevision === null) {
    return { kind: 'skipped' };
  }
  const current = await getAutoDelegation({ db: ctx.db, delegationId: delegation.id });
  const latest = await getAutoAttempt({ db: ctx.db, attemptId: attempt.id });
  if (current === null || latest === null || current.state === 'settled') {
    return { kind: 'skipped' };
  }
  const outcome = await ctx.scheduler.landRevision({
    treeId: delegation.treeId,
    delegationId: delegation.id,
    attemptId: attempt.id,
    generation,
    artifactId: brandId<ArtifactId>({ value: artifactId }),
    baseRevision,
    ask: landing.ask,
    sourceTurnId: landing.sourceTurnId,
    title: landing.title,
    sourceText: landing.sourceText,
    metadata: landing.metadata,
    result: envelope,
  });
  if (outcome.kind === 'landed' || outcome.kind === 'already_landed') {
    return { kind: outcome.kind, revision: outcome.revision };
  }
  const reason = failureOf({ outcome });
  if (reason === null) {
    return { kind: 'skipped' };
  }
  await ctx.scheduler.failRevise({
    treeId: delegation.treeId,
    delegationId: delegation.id,
    generation,
    artifactId: brandId<ArtifactId>({ value: artifactId }),
    reason,
    result: { ...envelope, outcome: 'failed', reason },
  });
  return { kind: 'failed', reason };
};
