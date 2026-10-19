import type {
  AutoDelegationRole,
  MountSnapshot,
  PickableMount,
  WorkflowRoutingWireFields,
} from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';
import type {
  AgentId,
  AutoAttemptId,
  AutoDelegationId,
  AutoTreeId,
  MessageAttachment,
  SessionId,
} from '@goodboy/types';

export type AgentGrant = Readonly<{
  agentId: AgentId;
  treeId: AutoTreeId;
  generation: number;
  workspaceId: string;
  sessionId: SessionId;
  runId: string;
}>;

export type AgentCommand = Readonly<{
  verb: string;
  args: Readonly<Record<string, unknown>>;
  grant: AgentGrant;
}>;

export type BridgeOutcome = Readonly<{
  isOk: boolean;
  error?: string;
  code?: string;
  data?: unknown;
}>;

export type RoutingRequest = Readonly<{
  sessionId: SessionId;
  role: AutoDelegationRole;
  fields: WorkflowRoutingWireFields;
  promptText: string;
}>;

export type RoutingProposalFate = 'kept' | 'adjusted' | 'replaced' | 'none';

export type RoutingOutcome =
  | Readonly<{
      kind: 'ready';
      provider: string;
      model: string;
      effort: string | null;
      reason: string;
      proposal: RoutingProposalFate;
    }>
  | Readonly<{
      kind: 'blocked';
      code: 'no_provider' | 'provider_unproven';
      message: string;
    }>;

type LoadMountsParams = Readonly<{
  sessionId: SessionId;
}>;

export type TurnExit = 'ok' | 'error' | 'cancelled';

export type AutoTurnEnded = Readonly<{
  treeId: AutoTreeId;
  generation: number;
  runId: string;
  deliveryId: string;
  agentId: AgentId;
  assistantText: string;
  exit: TurnExit;
  costUsd: number | null;
}>;

export type StartAutoTurnParams = Readonly<{
  treeId: AutoTreeId;
  agentId: AgentId;
  sessionId: SessionId;
  generation: number;
  runId: string;
  deliveryId: string;
  text: string;
  images?: ReadonlyArray<MessageAttachment>;
  onEnded: (ended: AutoTurnEnded) => void;
}>;

export type TurnStartOutcome =
  | Readonly<{ kind: 'started'; runId: string }>
  | Readonly<{ kind: 'duplicate'; runId: string }>
  | Readonly<{ kind: 'refused'; message: string }>;

export type DeliveryRun = Readonly<{
  runId: string;
  isLive: boolean;
}>;

export type LookupDeliveryRunParams = Readonly<{
  deliveryId: string;
}>;

export type EnsureChildAgentParams = Readonly<{
  delegation: AutoDelegation;
  sessionId: SessionId;
  parentAgentId: AgentId;
}>;

export type ChildMountTarget = Readonly<{
  mountId: string;
  mountRevision: number;
  worktreePath: string;
}>;

export type ChildTurnEnded = Readonly<{
  treeId: AutoTreeId;
  generation: number;
  delegationId: AutoDelegationId;
  attemptId: AutoAttemptId;
  runId: string;
  childAgentId: AgentId;
  sessionId: SessionId;
  assistantText: string;
  exit: TurnExit;
  costUsd: number | null;
  filesTouched: ReadonlyArray<string>;
  durationMs: number;
}>;

export type StartChildTurnParams = Readonly<{
  treeId: AutoTreeId;
  generation: number;
  delegationId: AutoDelegationId;
  attemptId: AutoAttemptId;
  childAgentId: AgentId;
  sessionId: SessionId;
  role: AutoDelegationRole;
  text: string;
  images?: ReadonlyArray<MessageAttachment>;
  mountTarget: ChildMountTarget;
  runId: string;
  captureMode: 'new' | 'revise';
  onEnded: (ended: ChildTurnEnded) => void;
}>;

export type ChildStartOutcome =
  | Readonly<{ kind: 'started'; runId: string }>
  | Readonly<{ kind: 'duplicate'; runId: string }>
  | Readonly<{ kind: 'refused'; reason: 'lease_busy' | 'kickoff_failed'; message: string }>;

export type ReadMountSnapshotParams = Readonly<{
  worktreePath: string;
}>;

export type CancelRunParams = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

export type CancelRunOutcome = Readonly<{
  outcome: 'exited' | 'still_running' | 'failed';
}>;

export type ReadRunOutcomeParams = Readonly<{
  runId: string;
  agentId: AgentId;
  sessionId: SessionId;
}>;

export type RunOutcome = Readonly<{
  assistantText: string;
  exit: TurnExit;
  costUsd: number | null;
}>;

type IsRunLiveParams = Readonly<{
  runId: string;
}>;

export type PublishScribeParams = Readonly<{
  sessionId: SessionId;
  mountId: string;
  agentId: AgentId;
  assistantText: string;
}>;

export type ScribePublication =
  | Readonly<{ kind: 'opened'; number: number; url: string }>
  | Readonly<{ kind: 'failed'; message: string }>;

export type RefreshSessionArtifactsParams = Readonly<{
  sessionId: SessionId;
}>;

export type AutoPorts = Readonly<{
  newId: () => string;
  refreshSessionArtifacts: (params: RefreshSessionArtifactsParams) => Promise<void>;
  loadMounts: (params: LoadMountsParams) => Promise<ReadonlyArray<PickableMount>>;
  resolveRouting: (params: RoutingRequest) => Promise<RoutingOutcome>;
  isPlanApprovalRequired: () => boolean;
  startAutoTurn: (params: StartAutoTurnParams) => Promise<TurnStartOutcome>;
  lookupDeliveryRun: (params: LookupDeliveryRunParams) => Promise<DeliveryRun | null>;
  ensureChildAgent: (params: EnsureChildAgentParams) => Promise<void>;
  startChildTurn: (params: StartChildTurnParams) => Promise<ChildStartOutcome>;
  readMountSnapshot: (params: ReadMountSnapshotParams) => Promise<MountSnapshot | null>;
  cancelRun: (params: CancelRunParams) => Promise<CancelRunOutcome>;
  isRunLive: (params: IsRunLiveParams) => Promise<boolean>;
  readRunOutcome: (params: ReadRunOutcomeParams) => Promise<RunOutcome | null>;
  publishScribePullRequest: (params: PublishScribeParams) => Promise<ScribePublication>;
}>;
