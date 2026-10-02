import type { BootstrapPhase, ProjectId, RemoteProbe, Session } from '@goodboy/types';
import type { MoveToBootstrapResult } from './moveToBootstrap';
import type { PublishFirstLapResult, PublishRemote } from './publishFirstLap';
import type { NewProject } from './createNewProject';
import type { BootstrapState } from './state';

export type CreateNewProjectParams = {
  readonly parentPath: string;
  readonly name: string;
};

export type SetBootstrapPhaseParams = {
  readonly projectId: ProjectId;
  readonly patch: Partial<Omit<BootstrapPhase, 'updatedAt'>>;
};

export type EnsureFirstLapSessionParams = {
  readonly projectId: ProjectId;
};

export type ProbeProjectRemoteParams = {
  readonly projectId: ProjectId;
};

export type PublishFirstLapParams = {
  readonly projectId: ProjectId;
  readonly remote: PublishRemote;
};

export type BootstrapSlice = BootstrapState & {
  hydrateBootstrapPhases(): Promise<void>;
  setBootstrapPhase(params: SetBootstrapPhaseParams): Promise<BootstrapPhase>;
  createNewProject(params: CreateNewProjectParams): Promise<NewProject>;
  ensureFirstLapSession(params: EnsureFirstLapSessionParams): Promise<Session>;
  probeProjectRemote(params: ProbeProjectRemoteParams): Promise<RemoteProbe>;
  publishFirstLap(params: PublishFirstLapParams): Promise<PublishFirstLapResult>;
  moveToBootstrap(params: ProbeProjectRemoteParams): Promise<MoveToBootstrapResult>;
  resumeBootstrapMove(params: ProbeProjectRemoteParams): Promise<MoveToBootstrapResult>;
  dismissBootstrapReport(params: ProbeProjectRemoteParams): void;
};
