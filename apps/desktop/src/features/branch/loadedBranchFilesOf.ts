import type { DiffView, FileDiff } from '@goodboy/types';

type Params = {
  readonly diff: {
    readonly view: DiffView;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly files: ReadonlyArray<FileDiff>;
  };
};

export const loadedBranchFilesOf = ({ diff }: Params): number | null =>
  diff.view.kind !== 'branch' || diff.isLoading || diff.error !== null ? null : diff.files.length;
