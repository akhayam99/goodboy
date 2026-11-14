import type { AppStore } from '../../../store';
import { selectMountBaseBranch } from '../../../slices/project-mounts/selectors';
import type { BaseBranchParams, HostChangeReaders } from './readHostChanges';

type Params = {
  readonly getState: () => AppStore;
};

export const baseBranchReaderOf =
  ({ getState }: Params): HostChangeReaders['baseBranchOf'] =>
  ({ sessionId, worktreePath }: BaseBranchParams) =>
    selectMountBaseBranch({ state: getState(), sessionId, path: worktreePath });
