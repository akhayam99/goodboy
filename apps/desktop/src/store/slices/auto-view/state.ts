import type { AutoArtifactLedgerRow, AutoDelegation, AutoTree } from '@goodboy/db';
import type { AutoBudgetFacts } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';

export type AutoTreeView = Readonly<{
  tree: AutoTree;
  delegations: ReadonlyArray<AutoDelegation>;
  artifacts: ReadonlyArray<AutoArtifactLedgerRow>;
  budget: AutoBudgetFacts | null;
}>;

export type AutoViewState = {
  readonly autoTreeViews: Readonly<Record<SessionId, ReadonlyArray<AutoTreeView>>>;
};

export const autoViewInitialState: AutoViewState = {
  autoTreeViews: {},
};
