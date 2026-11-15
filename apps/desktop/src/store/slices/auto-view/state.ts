import type { AutoLevel } from '@goodboy/core/auto';
import type {
  AutoArtifactLedgerRow,
  AutoDelegation,
  AutoGrant,
  AutoOutcome,
  AutoTree,
} from '@goodboy/db';
import type { AutoBudgetFacts, MountNote, OutcomeLine } from '@goodboy/core/auto';
import type { AgentId, MessageAttachment, ProviderRunId, SessionId } from '@goodboy/types';

export type AutoTreeView = Readonly<{
  tree: AutoTree;
  delegations: ReadonlyArray<AutoDelegation>;
  hiddenChildIds: ReadonlyArray<AgentId>;
  artifacts: ReadonlyArray<AutoArtifactLedgerRow>;
  budget: AutoBudgetFacts | null;
  pendingRefusal: AutoPendingRefusal | null;
  pendingMessages: ReadonlyArray<AutoPendingMessage>;
  readMessages?: ReadonlyArray<AutoReadMessage>;
  droppedMessageIds: ReadonlyArray<string>;
  deliveredResults: ReadonlyArray<AutoDeliveredResult>;
  rootAsk: string | null;
  level?: AutoLevel;
  grantAsks?: ReadonlyArray<AutoGrant>;
  launchSnapshots?: Readonly<Record<string, unknown>>;
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
  mount?: MountNote;
}>;

export type AutoPendingMessage = Readonly<{
  rowId: string;
  createdAt: number;
  text: string;
  images: ReadonlyArray<MessageAttachment>;
}>;

export type AutoReadMessage = Readonly<{
  rowId: string;
  createdAt: number;
  text: string;
  turn: number;
}>;

export type AutoViewState = {
  readonly autoTreeViews: Readonly<Record<SessionId, ReadonlyArray<AutoTreeView>>>;
  readonly autoClockAt: number;
};

export const autoViewInitialState: AutoViewState = {
  autoTreeViews: {},
  autoClockAt: 0,
};
