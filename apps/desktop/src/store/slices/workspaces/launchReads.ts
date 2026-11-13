import type { Project } from '@goodboy/types';

export type LaunchReads = {
  readonly projects: ReadonlyArray<Project>;
  readonly liveRunIds: ReadonlySet<string>;
};
