import type { SessionId, SessionProjectMount } from '@goodboy/types';
import type { AppState } from '../../types';

type DestinationState = Pick<
  AppState,
  'sessions' | 'sessionActiveMount' | 'sessionActiveProject' | 'sessionBranches'
>;

type Params = {
  readonly state: DestinationState;
  readonly sessionId: SessionId;
  readonly mount: SessionProjectMount | null;
};

export const writeDestinationPatch = ({ state, sessionId, mount }: Params): DestinationState => {
  const sessionActiveProject = { ...state.sessionActiveProject };
  const sessionBranches = { ...state.sessionBranches };
  if (mount === null) {
    delete sessionActiveProject[sessionId];
    delete sessionBranches[sessionId];
  } else {
    sessionActiveProject[sessionId] = mount.projectId;
    sessionBranches[sessionId] = mount.branch;
  }
  return {
    sessions: state.sessions.map((candidate) => {
      if (candidate.id !== sessionId) {
        return candidate;
      }
      const { activeMountId: _mount, activeProjectId: _project, ...rest } = candidate;
      return mount === null
        ? rest
        : { ...rest, activeMountId: mount.mountId, activeProjectId: mount.projectId };
    }),
    sessionActiveMount: { ...state.sessionActiveMount, [sessionId]: mount?.mountId ?? null },
    sessionActiveProject,
    sessionBranches,
  };
};
