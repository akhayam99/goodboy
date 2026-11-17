import type { AutoLedgerEntry } from './ledger';
import type { AutoLevel } from './level';
import type { UserFacts } from './outboxPayload';

type Params = {
  readonly entries: ReadonlyArray<AutoLedgerEntry>;
  readonly level: AutoLevel;
};

export const waitingPlanChangeOf = ({ entries, level }: Params): UserFacts['explicitChange'] => {
  if (level === 'run') {
    return null;
  }
  const waiting = entries.filter(
    (entry) =>
      entry.kind === 'plan' &&
      entry.status !== 'consumed' &&
      entry.approval === 'needs_approval' &&
      entry.openReviseDelegationId === null,
  );
  const plan = waiting[0];
  if (waiting.length !== 1 || plan === undefined) {
    return null;
  }
  return { artifactId: plan.artifactId, baseRevision: plan.revision, commentIds: [] };
};
