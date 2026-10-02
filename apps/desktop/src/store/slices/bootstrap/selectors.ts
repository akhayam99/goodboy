import type { BootstrapPhase, ProjectId } from '@goodboy/types';
import type { BootstrapState } from './state';

export const selectBootstrapPhase = (
  state: BootstrapState,
  projectId: ProjectId,
): BootstrapPhase | null => state.bootstrapPhase[projectId] ?? null;

export const selectIsFirstLap = (state: BootstrapState, projectId: ProjectId): boolean =>
  state.bootstrapPhase[projectId]?.stage === 'first-lap';
