import type { BootstrapPhase, IsoDateTime, ProjectId, RemoteProbe } from '@goodboy/types';

export type BootstrapRemoteProbeEntry = {
  readonly probe: RemoteProbe;
  readonly readAt: IsoDateTime;
};

export type BootstrapState = {
  readonly bootstrapPhase: Readonly<Record<ProjectId, BootstrapPhase>>;
  readonly bootstrapRemoteProbe: Readonly<Record<ProjectId, BootstrapRemoteProbeEntry>>;
};

export const bootstrapInitialState: BootstrapState = {
  bootstrapPhase: {},
  bootstrapRemoteProbe: {},
};
