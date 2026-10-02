import type {
  BootstrapAlignOutcome,
  BootstrapPhase,
  IsoDateTime,
  ProjectId,
  RemoteProbe,
  SessionId,
} from '@goodboy/types';

export type BootstrapRemoteProbeEntry = {
  readonly probe: RemoteProbe;
  readonly readAt: IsoDateTime;
};

export type BootstrapMoveReport = {
  readonly projectId: ProjectId;
  readonly bootstrapSessionId: SessionId | null;
  readonly movedCount: number;
  readonly kept: ReadonlyArray<string>;
  readonly largeFiles: ReadonlyArray<string>;
  readonly ignoredAtRisk: ReadonlyArray<string>;
  readonly aligned: BootstrapAlignOutcome | null;
};

export type BootstrapState = {
  readonly bootstrapPhase: Readonly<Record<ProjectId, BootstrapPhase>>;
  readonly bootstrapRemoteProbe: Readonly<Record<ProjectId, BootstrapRemoteProbeEntry>>;
  readonly bootstrapMoveReport: Readonly<Record<ProjectId, BootstrapMoveReport>>;
};

export const bootstrapInitialState: BootstrapState = {
  bootstrapPhase: {},
  bootstrapRemoteProbe: {},
  bootstrapMoveReport: {},
};
