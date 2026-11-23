import {
  mountRequestOf,
  sessionMountViews,
} from '../../../store/slices/project-mounts/mountRowModel';
import { pullRequestViewOf } from '../../../store/slices/pull-request-view/pullRequestViewOf';
import type { AppState } from '../../../store/types';
import type { ReadyCar } from './mergeOrderOf';
import type { ReadyRow } from './readyToMergeOf';

type Params = {
  readonly state: AppState;
  readonly rows: ReadonlyArray<ReadyRow>;
};

export const readyCarsOf = ({ state, rows }: Params): ReadonlyArray<ReadyCar> =>
  rows.flatMap((row): ReadonlyArray<ReadyCar> => {
    const { sessionId, number } = row;
    if (number === null) {
      return [];
    }
    const mount = sessionMountViews({ state, sessionId }).find(
      (view) => view.isAttached && mountRequestOf({ state, mountId: view.id })?.number === number,
    );
    if (mount === undefined) {
      return [];
    }
    const project = state.projects.find((candidate) => candidate.id === mount.projectId);
    const view = pullRequestViewOf({ state, sessionId, mountId: mount.id, prNumber: number })?.view;
    return [
      {
        sessionId,
        number,
        mountId: mount.id,
        projectId: mount.projectId,
        repo: project?.name ?? mount.mountName,
        branch: mount.branch,
        base: state.mountGithub[mount.id]?.pr?.baseBranch ?? mount.baseBranch ?? 'its base',
        fileCount: view?.files.count ?? null,
      },
    ];
  });
