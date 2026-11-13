import type { WorkspaceId } from '@goodboy/types';
import { countPerf } from '../../../shared/lib/countPerf';
import { PERF_COUNT_NAMES } from '../../../shared/lib/perfCountNames';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<
    AppState,
    'sessions' | 'projects' | 'browserSessionTabs' | 'browserProjectPins'
  >;
  readonly workspaceId: WorkspaceId;
};

export const workspaceTabCount = ({ state, workspaceId }: Params): number => {
  countPerf({ name: PERF_COUNT_NAMES.browserTabCount });
  const sessionTabs = state.sessions.reduce(
    (total, session) =>
      session.workspaceId === workspaceId
        ? total + (state.browserSessionTabs[session.id]?.length ?? 0)
        : total,
    0,
  );
  return state.projects.reduce(
    (total, project) =>
      project.workspaceId === workspaceId
        ? total + (state.browserProjectPins[project.id]?.length ?? 0)
        : total,
    sessionTabs,
  );
};
