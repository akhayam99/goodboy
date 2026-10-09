import type { SessionId } from '@goodboy/types';
import type { DrawerRequest } from '../../../store/slices/drawer/state';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
  readonly focusPath?: string | null;
  readonly focusThreadId?: string | null;
};

export const reviewNotesDrawer = ({
  sessionId,
  mountPath,
  focusPath = null,
  focusThreadId = null,
}: Params): DrawerRequest => ({
  kind: 'review-notes',
  sessionId,
  payload: { mountPath, focusPath, focusThreadId },
});
