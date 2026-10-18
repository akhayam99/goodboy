import type { AgentId, MountId, SessionId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type RebaseAllBranchState =
  'queued' | 'rebasing' | 'rebased' | 'conflict' | 'auto' | 'failed' | 'skipped';

export type RebaseAllBranch = {
  readonly mountId: MountId;
  readonly projectName: string;
  readonly branch: string;
  readonly state: RebaseAllBranchState;
  readonly message: string | null;
};

type RebaseAllPhase = 'running' | 'handing' | 'handed' | 'done' | 'aborted';

export type RebaseAllRun = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly shouldTidy: boolean;
  readonly isAborted: boolean;
  readonly phase: RebaseAllPhase;
  readonly branches: ReadonlyArray<RebaseAllBranch>;
  readonly autoAgentId: AgentId | null;
  readonly error: string | null;
};

export type RebaseAllInput = {
  readonly sessionId: SessionId;
  readonly mountIds: ReadonlyArray<MountId>;
  readonly shouldTidy: boolean;
};

export type RebaseAllOutcome = 'done' | 'handed' | 'aborted' | 'busy' | 'empty';

export type RebaseAllRunInput = {
  readonly sessionId: SessionId;
  readonly runId: string;
};

export type ResolveRebaseWithAutoInput = {
  readonly sessionId: SessionId;
  readonly mountIds: ReadonlyArray<MountId>;
  readonly tidyMountIds?: ReadonlyArray<MountId>;
  readonly hint: string;
  readonly onAccepted?: (params: ResolveAcceptedParams) => void;
};

type ResolveAcceptedParams = {
  readonly agentId: AgentId;
};

export type ResolveRebaseWithAutoOutcome =
  { readonly kind: 'started'; readonly agentId: AgentId } | { readonly kind: 'nothing' };
