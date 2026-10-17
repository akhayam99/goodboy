import type { MountId, SessionId } from '@goodboy/types';
import type { DrawerRequest } from '../drawer/state';

type Params = {
  readonly openDrawer: (request: DrawerRequest) => void;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly focusThreadId?: string | null;
  readonly threadIds?: ReadonlyArray<string>;
  readonly fromThreadId?: string | null;
};

export const openFixComments = ({
  openDrawer,
  sessionId,
  mountId,
  focusThreadId = null,
  threadIds,
  fromThreadId = null,
}: Params): void =>
  openDrawer({
    kind: 'fix-comments',
    sessionId,
    payload: {
      mountId,
      focusThreadId,
      ...(threadIds !== undefined && { threadIds }),
      ...(fromThreadId !== null && { fromThreadId }),
    },
  });
