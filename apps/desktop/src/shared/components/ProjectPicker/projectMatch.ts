import type { ProjectId } from '@goodboy/types';

export type ProjectMatch = {
  readonly projectId: ProjectId;
  readonly reason: string;
};
