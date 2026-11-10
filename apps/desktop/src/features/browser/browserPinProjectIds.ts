import type { ProjectId } from '@goodboy/types';

type Params = {
  readonly projectOf: ReadonlyArray<ProjectId | null>;
};

export const browserPinProjectIds = ({ projectOf }: Params): ReadonlyArray<ProjectId> =>
  Array.from(new Set(projectOf.filter((id): id is ProjectId => id !== null))).sort();
