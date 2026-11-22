import type { MountId, Project, ProjectId, SessionId } from '@goodboy/types';
import type { ShowToast } from '../../../../../shared/components/Toast/toastContext';
import { undoable } from '../../../../../shared/utils/undoable';
import type { EnsureProjectMountedInput } from '../../../../../store/slices/project-mounts/types';
import type { AppStore } from '../../../../../store/store';

type MountOptions = Omit<EnsureProjectMountedInput, 'sessionId' | 'projectId' | 'reason'>;

type MountStore = Pick<
  AppStore,
  | 'ensureProjectMounted'
  | 'removeMountWorktree'
  | 'forgetMount'
  | 'removeProject'
  | 'loadSessionMounts'
  | 'sessionMounts'
  | 'sessionProjectMounts'
  | 'sessions'
  | 'projects'
>;

type Params = {
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly isAdded: boolean;
  readonly options: MountOptions;
  readonly getState: () => MountStore;
  readonly showToast: ShowToast;
};

type CreatedMount = {
  readonly mountId: MountId;
  revision: number;
  stage: 'mounted' | 'worktree-removed' | 'forgotten';
};

type ViewParams = {
  readonly getState: () => MountStore;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

const freshViewOf = async ({ getState, sessionId, mountId }: ViewParams) =>
  (await getState().loadSessionMounts({ sessionId })).find((view) => view.id === mountId);

type UseParams = {
  readonly state: MountStore;
  readonly projectId: ProjectId;
};

const isProjectInUse = ({ state, projectId }: UseParams): boolean =>
  Object.values(state.sessionMounts).some((views) =>
    views.some((view) => view.projectId === projectId),
  ) || state.sessions.some((session) => session.activeProjectId === projectId);

type UnmountParams = {
  readonly getState: () => MountStore;
  readonly sessionId: SessionId;
  readonly created: CreatedMount;
};

const unmountCreated = async ({
  getState,
  sessionId,
  created,
}: UnmountParams): Promise<boolean> => {
  const mountId = created.mountId;
  if (created.stage === 'mounted') {
    const view = await freshViewOf({ getState, sessionId, mountId });
    if (view?.revision !== created.revision || !view.isAttached || view.worktreePath === null) {
      return false;
    }
    const removal = await getState().removeMountWorktree({ sessionId, mountId, mode: 'safe' });
    if (removal.kind === 'kept' || removal.kind === 'failed') {
      throw new Error(removal.reason ?? 'The worktree stayed, so the folder stays mounted.');
    }
    const settled = await freshViewOf({ getState, sessionId, mountId });
    if (settled === undefined) {
      return false;
    }
    created.revision = settled.revision;
    created.stage = 'worktree-removed';
  }
  if (created.stage === 'worktree-removed') {
    const view = await freshViewOf({ getState, sessionId, mountId });
    if (view?.revision !== created.revision || view.isAttached) {
      return false;
    }
    await getState().forgetMount({ sessionId, mountId, expectedRevision: created.revision });
    created.stage = 'forgotten';
  }
  return true;
};

const MANUAL_REASON = 'added manually by the user';

export const mountWithUndo = async ({
  sessionId,
  project,
  isAdded,
  options,
  getState,
  showToast,
}: Params): Promise<void> => {
  const result = await getState().ensureProjectMounted({
    sessionId,
    projectId: project.id,
    reason: MANUAL_REASON,
    ...options,
  });
  const message = `Mounted ${project.name}. Agents in this session can read and write it.`;
  if (result.status !== 'created' && !isAdded) {
    showToast({ kind: 'info', message });
    return;
  }
  const created: CreatedMount | null =
    result.status === 'created'
      ? {
          mountId: result.createdMountId,
          revision:
            (getState().sessionProjectMounts[sessionId] ?? []).find(
              (mount) => mount.mountId === result.createdMountId,
            )?.revision ?? 0,
          stage: 'mounted',
        }
      : null;
  undoable({
    message,
    doneMessage: `Unmounted ${project.name}.`,
    showToast,
    undo: async () => {
      if (created !== null && !(await unmountCreated({ getState, sessionId, created }))) {
        return false;
      }
      if (!isAdded) {
        return true;
      }
      const state = getState();
      if (!state.projects.some((candidate) => candidate.id === project.id)) {
        return true;
      }
      if (isProjectInUse({ state, projectId: project.id })) {
        throw new Error(`${project.name} stays in the workspace because a session uses it now.`);
      }
      await state.removeProject({ projectId: project.id });
      return true;
    },
  });
};
