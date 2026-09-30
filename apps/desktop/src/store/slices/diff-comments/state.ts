import type { DiffComment } from '@goodboy/types';

export type DiffCommentsState = {
  readonly diffComments: Readonly<Record<string, ReadonlyArray<DiffComment>>>;
};

export const diffCommentsInitialState: DiffCommentsState = {
  diffComments: {},
};
