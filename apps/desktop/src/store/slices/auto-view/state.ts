import type { AutoArtifactLedgerRow, AutoDelegation, AutoOutcome, AutoTree } from '@goodboy/db';
import type { AutoBudgetFacts, OutcomeLine } from '@goodboy/core';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';

export type AutoTreeView = Readonly<{
  tree: AutoTree;
  delegations: ReadonlyArray<AutoDelegation>;
  hiddenChildIds: ReadonlyArray<AgentId>;
  artifacts: ReadonlyArray<AutoArtifactLedgerRow>;
  budget: AutoBudgetFacts | null;
  pendingRefusal: AutoPendingRefusal | null;
  pendingMessages: ReadonlyArray<AutoPendingMessage>;
  deliveredResults: ReadonlyArray<AutoDeliveredResult>;
  rootAsk: string | null;
}>;

export type AutoDeliveredArtifact = Readonly<{
  artifactId: string;
  kind: string;
  title: string;
  revision: number | null;
}>;

export type AutoDeliveredResult = Readonly<{
  runId: ProviderRunId;
  delegationId: string;
  childAgentId: AgentId;
  role: string;
  provider: string | null;
  model: string | null;
  outcome: AutoOutcome;
  summary: string | null;
  outcomeLine: OutcomeLine | null;
  artifacts: ReadonlyArray<AutoDeliveredArtifact>;
}>;

export type AutoPendingRefusal = Readonly<{
  action: string;
  code: string;
  roles: ReadonlyArray<string>;
}>;

export type AutoPendingMessage = Readonly<{
  rowId: string;
  createdAt: number;
}>;

export type AutoViewState = {
  readonly autoTreeViews: Readonly<Record<SessionId, ReadonlyArray<AutoTreeView>>>;
};

export const autoViewInitialState: AutoViewState = {
  autoTreeViews: {},
};
