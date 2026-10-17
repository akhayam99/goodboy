import type { BaseDivergence, ProjectId, WorkspaceId } from '@goodboy/types';

export type RepoPull =
  { readonly kind: 'pulling' } | { readonly kind: 'refused'; readonly reason: string };

export type RepoDivergenceState = {
  readonly repoDivergence: Readonly<Record<ProjectId, BaseDivergence>>;
  readonly repoCheckInFlight: Readonly<Record<WorkspaceId, boolean>>;
  readonly repoCheckedAt: Readonly<Record<WorkspaceId, number>>;
  readonly repoPull: Readonly<Record<ProjectId, RepoPull>>;
};

export const repoDivergenceInitialState: RepoDivergenceState = {
  repoDivergence: {},
  repoCheckInFlight: {},
  repoCheckedAt: {},
  repoPull: {},
};
