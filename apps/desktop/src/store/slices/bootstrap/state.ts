import type { BootstrapPhase, ProjectId } from '@goodboy/types';

export type BootstrapState = {
  readonly bootstrapPhase: Readonly<Record<ProjectId, BootstrapPhase>>;
};

export const bootstrapInitialState: BootstrapState = {
  bootstrapPhase: {},
};
