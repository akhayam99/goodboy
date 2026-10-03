import type { DiffComment } from '@goodboy/types';

export type DiffCommentsState = {
  readonly diffComments: Readonly<Record<string, ReadonlyArray<DiffComment>>>;
  readonly diffNoteLaunch: Readonly<Record<string, ReadonlyArray<string>>>;
};

export const diffCommentsInitialState: DiffCommentsState = {
  diffComments: {},
  diffNoteLaunch: {},
};
