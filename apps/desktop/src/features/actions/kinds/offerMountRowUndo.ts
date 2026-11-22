import type { SessionMount } from '@goodboy/types';
import type { ActionEnv } from '../types';

type Params = {
  readonly env: ActionEnv;
  readonly removed: SessionMount | null;
  readonly label: string;
  readonly isFolderRemoved: boolean;
};

export const offerMountRowUndo = ({ env, removed, label, isFolderRemoved }: Params): void => {
  if (removed === null) {
    return;
  }
  env.getState().undoable({
    message: isFolderRemoved ? `Unmounted ${label} and removed its folder.` : `Unmounted ${label}.`,
    doneMessage: isFolderRemoved
      ? `${label} is back in the session. Its folder stays removed.`
      : `${label} is back in the session.`,
    showToast: env.showToast,
    undo: () => env.getState().restoreMountRow({ mount: removed }),
  });
};
