import type { SessionId } from '@goodboy/types';

export type BranchFilesFilterState = {
  readonly branchFilesFolder: Readonly<Record<SessionId, string | null>>;
};

export const branchFilesFilterInitialState: BranchFilesFilterState = {
  branchFilesFolder: {},
};
