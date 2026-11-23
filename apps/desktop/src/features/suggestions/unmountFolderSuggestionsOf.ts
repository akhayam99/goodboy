import type { SessionId } from '@goodboy/types';
import type { SignalIdleMount } from './nextStepSignals';
import { idleDaysOf } from './signals/idleDaysOf';
import type { SessionSuggestion } from './types';

type UnmountFolder = Extract<SessionSuggestion, { readonly kind: 'unmount-folder' }>;

type Params = {
  readonly sessionId: SessionId;
  readonly idleMounts: ReadonlyArray<SignalIdleMount>;
  readonly now: () => number;
};

export const unmountFolderSuggestionsOf = ({
  sessionId,
  idleMounts,
  now,
}: Params): ReadonlyArray<UnmountFolder> =>
  idleMounts.flatMap((mount): ReadonlyArray<UnmountFolder> => {
    const idleDays = idleDaysOf({ lastTouchedMs: mount.lastTouchedMs, now });
    if (mount.isRepo || idleDays === null) {
      return [];
    }
    return [
      {
        id: `unmount-folder:${mount.mountId}`,
        kind: 'unmount-folder',
        priority: 53,
        band: 3,
        title: `Unmount ${mount.projectName}`,
        detail: `No turn touched it for ${idleDays} days`,
        sessionId,
        targetKey: `worktree:${mount.mountId}`,
        fingerprint: `unmount-folder:${mount.mountId}`,
        payload: {
          mountId: mount.mountId,
          projectId: mount.projectId,
          projectName: mount.projectName,
          idleDays,
        },
      },
    ];
  });
