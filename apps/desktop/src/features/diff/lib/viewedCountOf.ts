import type { FileDiff } from '@goodboy/types';
import type { ViewedState } from './reviewedFiles';

type Params = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly stateOf: (file: FileDiff) => ViewedState;
};

export const viewedCountOf = ({ files, stateOf }: Params): number =>
  files.filter((file) => stateOf(file) === 'viewed').length;
