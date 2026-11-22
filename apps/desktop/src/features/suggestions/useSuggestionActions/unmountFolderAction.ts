import type { MountId, SessionId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import type { AppStore } from '../../../store/store';
import type { SuggestionActions } from '.';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectName: string;
  readonly unmountMount: AppStore['unmountMount'];
  readonly attachMount: AppStore['attachMount'];
  readonly undoable: AppStore['undoable'];
};

type ConflictParams = {
  readonly error: unknown;
};

const isRevisionConflict = ({ error }: ConflictParams): boolean =>
  error instanceof Error && 'code' in error && error.code === 'revision-conflict';

export const unmountFolderAction = ({
  sessionId,
  mountId,
  projectName,
  unmountMount,
  attachMount,
  undoable,
}: Params): SuggestionActions['primary'] => ({
  label: NAMES.unmount,
  isDisabled: false,
  requiresConfirm: true,
  failureTitle: `Couldn't unmount ${projectName}`,
  run: async () => {
    const { mount } = await unmountMount({ sessionId, mountId });
    undoable({
      message: `Unmounted ${projectName}.`,
      doneMessage: `Mounted ${projectName} again.`,
      undo: async () => {
        try {
          await attachMount({ sessionId, mountId, expectedRevision: mount.revision });
        } catch (error) {
          if (isRevisionConflict({ error })) {
            return false;
          }
          throw error;
        }
        return true;
      },
    });
  },
});
