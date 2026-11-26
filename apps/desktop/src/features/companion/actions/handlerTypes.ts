import type { AutoLevel } from '@goodboy/core/auto';
import type { SetAutoTreeCapOutcome } from '@goodboy/db';
import type { AutoPlanApproval } from '../../auto/plan/approveAutoPlan';
import type {
  AgentId,
  ArtifactId,
  AutoTreeId,
  ClaudePermissionMode,
  SessionId,
  Workflow,
  WorkspaceId,
} from '@goodboy/types';
import type { StartLimit } from '../../auto/startLimitOf';
import type { AppStore } from '../../../store/store';
import type { Refusal } from '../contract/actions';
import type { ActionId } from '../contract/primitives';
import type { StartKind, TaskProvider } from '../contract/vocabulary';

export type HandlerResult =
  | {
      readonly kind: 'done';
      readonly undoActionId: ActionId | null;
      readonly createdSessionId: string | null;
    }
  | { readonly kind: 'refused'; readonly refusal: Refusal }
  | { readonly kind: 'failed'; readonly error: string };

export type ApprovePlanPortParams = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly artifactId: ArtifactId;
  readonly expectedRevision: number;
};

export type SetTreeCapPortParams = {
  readonly sessionId: SessionId;
  readonly treeId: AutoTreeId;
  readonly expectedCapUsd: number | null;
  readonly capUsd: number;
};

export type DecidePorts = {
  readonly approvePlan: (params: ApprovePlanPortParams) => Promise<AutoPlanApproval>;
  readonly setTreeCap: (params: SetTreeCapPortParams) => Promise<SetAutoTreeCapOutcome>;
};

export type HandlerParams<Action> = {
  readonly action: Action;
  readonly getStore: () => AppStore;
  readonly ports: DecidePorts;
};

export type StoreHandlerParams<Action> = {
  readonly action: Action;
  readonly getStore: () => AppStore;
};

export type StartLaunchParams = {
  readonly sessionId: SessionId;
  readonly mode: ClaudePermissionMode;
  readonly startKind: StartKind;
  readonly preset: Workflow | null;
  readonly ask: string;
  readonly limit: StartLimit | null;
  readonly level: AutoLevel | null;
};

type ExternalTasks = NonNullable<Parameters<AppStore['createSession']>[0]['externalTasks']>;

export type ResolvedTask = {
  readonly goal: string;
  readonly externalTask: ExternalTasks[number];
};

export type ResolveTaskParams = {
  readonly workspaceId: WorkspaceId;
  readonly provider: TaskProvider;
  readonly key: string;
};

export type DiscardParams = {
  readonly sessionId: SessionId;
};

export type StartPorts = {
  readonly resolveTask: (params: ResolveTaskParams) => Promise<ResolvedTask>;
  readonly launch: (params: StartLaunchParams) => Promise<void>;
  readonly discard: (params: DiscardParams) => Promise<void>;
};
