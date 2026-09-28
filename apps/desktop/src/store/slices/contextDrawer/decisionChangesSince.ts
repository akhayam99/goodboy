import type { SessionDecision } from '@goodboy/types';

export type DecisionChangesSince = {
  readonly added: ReadonlyArray<SessionDecision>;
  readonly removed: ReadonlyArray<SessionDecision>;
  readonly reworded: ReadonlyArray<SessionDecision>;
};

type Params = {
  readonly ledger: ReadonlyArray<SessionDecision> | undefined;
  readonly since: string | null | undefined;
};

export const NO_DECISION_CHANGES: DecisionChangesSince = { added: [], removed: [], reworded: [] };

const isAdded = (row: SessionDecision, since: string): boolean =>
  row.status === 'active' && row.author !== 'user' && row.createdAt > since;

const isRemoved = (row: SessionDecision, since: string): boolean =>
  row.status !== 'active' &&
  row.closedBy !== 'user' &&
  row.createdAt <= since &&
  row.updatedAt > since;

const isReworded = (row: SessionDecision, since: string): boolean =>
  row.status === 'active' &&
  row.createdAt <= since &&
  row.previousText !== null &&
  row.rewordedAt !== null &&
  row.rewordedAt > since;

export const decisionChangesSince = ({ ledger, since }: Params): DecisionChangesSince => {
  if (ledger === undefined || typeof since !== 'string') {
    return NO_DECISION_CHANGES;
  }
  const added = ledger.filter((row) => isAdded(row, since));
  const removed = ledger.filter((row) => isRemoved(row, since));
  const reworded = ledger.filter((row) => isReworded(row, since));
  if (added.length === 0 && removed.length === 0 && reworded.length === 0) {
    return NO_DECISION_CHANGES;
  }
  return { added, removed, reworded };
};

export const hasDecisionChanges = (changes: DecisionChangesSince): boolean =>
  changes !== NO_DECISION_CHANGES;
