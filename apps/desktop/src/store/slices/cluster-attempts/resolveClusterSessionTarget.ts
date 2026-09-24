import type { Project, SessionId, SessionProjectMount } from '@goodboy/types';
import type { AppState } from '../../types';
import { selectActiveMount, selectWritableMounts } from '../project-mounts/selectors';

type Params = {
  readonly state: Pick<
    AppState,
    | 'sessions'
    | 'sessionMounts'
    | 'sessionProjectMounts'
    | 'sessionActiveMount'
    | 'sessionActiveProject'
    | 'projects'
    | 'clusterAttempts'
  >;
  readonly sessionId: SessionId;
};

export type ClusterSessionTarget = Readonly<{
  mount: SessionProjectMount;
  project: Project;
}>;

const byAutomaticOrder = (left: SessionProjectMount, right: SessionProjectMount): number => {
  if (left.parallelIndex !== right.parallelIndex) {
    return left.parallelIndex - right.parallelIndex;
  }
  if (left.mountId === right.mountId) {
    return 0;
  }
  return left.mountId < right.mountId ? -1 : 1;
};

export const resolveClusterSessionTarget = ({
  state,
  sessionId,
}: Params): ClusterSessionTarget | null => {
  const attemptMountIds = new Set(
    (state.clusterAttempts?.[sessionId] ?? []).flatMap((attempt) =>
      attempt.target === null ? [] : [attempt.target.mountId],
    ),
  );
  const active = selectActiveMount({ state, sessionId });
  const fallback =
    selectWritableMounts({ state, sessionId })
      .filter((candidate) => !attemptMountIds.has(candidate.mountId))
      .sort(byAutomaticOrder)[0] ?? null;
  const mount = active !== null && !attemptMountIds.has(active.mountId) ? active : fallback;
  if (mount === null) {
    return null;
  }
  const project = state.projects.find((candidate) => candidate.id === mount.projectId);
  if (project === undefined || project.kind !== 'repo') {
    return null;
  }
  return { mount, project };
};
