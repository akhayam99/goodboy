import type { Project, SessionId } from '@goodboy/types';
import type { ShowToast } from '../../../../../shared/components/Toast/toastContext';
import { undoable } from '../../../../../shared/utils/undoable';
import type { EnsureProjectMountedInput } from '../../../../../store/slices/project-mounts/types';
import type { AppStore } from '../../../../../store/store';

type MountOptions = Omit<EnsureProjectMountedInput, 'sessionId' | 'projectId' | 'reason'>;

type Params = {
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly isAdded: boolean;
  readonly options: MountOptions;
  readonly store: Pick<AppStore, 'ensureProjectMounted' | 'detachProject' | 'removeProject'>;
  readonly showToast?: ShowToast;
};

const MANUAL_REASON = 'added manually by the user';

export const mountWithUndo = async ({
  sessionId,
  project,
  isAdded,
  options,
  store,
  showToast,
}: Params): Promise<void> => {
  const result = await store.ensureProjectMounted({
    sessionId,
    projectId: project.id,
    reason: MANUAL_REASON,
    ...options,
  });
  undoable({
    message: `Mounted ${project.name}. Agents in this session can read and write it.`,
    doneMessage: `Unmounted ${project.name}.`,
    ...(showToast === undefined ? {} : { showToast }),
    undo: async () => {
      if (result.status !== 'in-place') {
        const outcomes = await store.detachProject({
          sessionId,
          projectId: project.id,
          disposition: 'remove-clean',
        });
        if (outcomes.some((outcome) => outcome.kind === 'failed')) {
          return false;
        }
      }
      if (isAdded) {
        await store.removeProject({ projectId: project.id });
      }
      return true;
    },
  });
};
