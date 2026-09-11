import type { AgentId, MountBranchObservation, MountId, SessionMountView } from '@goodboy/types';
import type { WriteDestination } from './writeDestination';

export type ProjectMountsState = {
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
  readonly mountBranchObservations: Readonly<Record<string, ReadonlyArray<MountBranchObservation>>>;
  readonly sessionActiveMount: Readonly<Record<string, MountId | null>>;
  readonly agentTurnDestination: Readonly<Record<AgentId, WriteDestination>>;
};

export const projectMountsInitialState: ProjectMountsState = {
  sessionMounts: {},
  mountBranchObservations: {},
  sessionActiveMount: {},
  agentTurnDestination: {},
};
