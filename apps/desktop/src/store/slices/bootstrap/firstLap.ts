import type { Project, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { sessionById } from '../sessions/sessionIndex';

type FirstLapState = Pick<AppStore, 'sessions' | 'projects' | 'bootstrapPhase'>;

type SessionParams = {
  readonly state: FirstLapState;
  readonly sessionId: SessionId;
};

type ProjectParams = {
  readonly state: Pick<AppStore, 'bootstrapPhase'>;
  readonly projectId: ProjectId;
};

export const FIRST_LAP_REFUSAL =
  'This project is still in its first lap, so work happens in the project folder. Publish it to start worktree sessions.';

export const isProjectInFirstLap = ({ state, projectId }: ProjectParams): boolean =>
  state.bootstrapPhase[projectId]?.stage === 'first-lap';

export const selectFirstLapProject = ({ state, sessionId }: SessionParams): Project | null => {
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return null;
  }
  for (const project of state.projects) {
    if (project.workspaceId !== session.workspaceId || project.kind !== 'repo') {
      continue;
    }
    const phase = state.bootstrapPhase[project.id];
    if (phase?.stage === 'first-lap' && phase.firstLapSessionId === sessionId) {
      return project;
    }
  }
  return null;
};

type WorkspaceParams = {
  readonly state: Pick<AppStore, 'projects' | 'bootstrapPhase'>;
  readonly workspaceId: WorkspaceId;
};

export const firstLapProjectOfWorkspace = ({
  state,
  workspaceId,
}: WorkspaceParams): Project | null => {
  for (const project of state.projects) {
    if (
      project.workspaceId === workspaceId &&
      isProjectInFirstLap({ state, projectId: project.id })
    ) {
      return project;
    }
  }
  return null;
};

export type LapProject = {
  readonly project: Project;
  readonly stage: 'first-lap' | 'moving';
};

export const selectLapProject = ({ state, sessionId }: SessionParams): LapProject | null => {
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return null;
  }
  for (const project of state.projects) {
    if (project.workspaceId !== session.workspaceId || project.kind !== 'repo') {
      continue;
    }
    const phase = state.bootstrapPhase[project.id];
    if (phase === undefined) {
      continue;
    }
    if (phase.stage === 'first-lap' && phase.firstLapSessionId === sessionId) {
      return { project, stage: phase.stage };
    }
    const ownsMove =
      phase.firstLapSessionId === sessionId || phase.bootstrapSessionId === sessionId;
    if (phase.stage === 'moving' && ownsMove) {
      return { project, stage: phase.stage };
    }
  }
  return null;
};
