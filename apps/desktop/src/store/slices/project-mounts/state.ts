import type { SessionWorktree } from '@goodboy/db';

import type {
  AgentId,
  MountBranchObservation,
  MountId,
  SessionMountView,
  SessionProjectMount,
  ProjectId,
} from '@goodboy/types';
import type { WriteDestination } from './writeDestination';

export type ProjectMountsState = {
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
  readonly mountBranchObservations: Readonly<Record<string, ReadonlyArray<MountBranchObservation>>>;
  readonly sessionActiveMount: Readonly<Record<string, MountId | null>>;
  readonly agentTurnDestination: Readonly<Record<AgentId, WriteDestination>>;

  readonly sessionWorktrees: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly sessionWorktreeRecords?: Readonly<Record<string, ReadonlyArray<SessionWorktree>>>;
  readonly sessionProjectMounts: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
  readonly sessionActiveProject: Readonly<Record<string, ProjectId>>;
  readonly sessionBranches: Readonly<Record<string, string>>;
};

export const projectMountsInitialState: ProjectMountsState = {
  sessionMounts: {},
  mountBranchObservations: {},
  sessionActiveMount: {},
  agentTurnDestination: {},

  sessionWorktrees: {},
  sessionWorktreeRecords: {},
  sessionProjectMounts: {},
  sessionActiveProject: {},
  sessionBranches: {},
};
