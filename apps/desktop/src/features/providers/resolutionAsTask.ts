import type { Resolution } from '@goodboy/core';
import type { TaskModelPreference } from '@goodboy/types';

type Params = {
  readonly resolution: Resolution;
};

export const resolutionAsTask = ({ resolution }: Params): TaskModelPreference => ({
  providerId: resolution.provider,
  model: resolution.model,
  ...(resolution.effort !== null && { effort: resolution.effort }),
});
