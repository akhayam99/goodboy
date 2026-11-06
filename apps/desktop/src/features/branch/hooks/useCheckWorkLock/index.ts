import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { checkWorkLockOf } from '../../checks/checkWorkLockOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export const useCheckWorkLock = ({ sessionId, mountId }: Params): string | null =>
  useAppStore((state) => checkWorkLockOf({ state, sessionId, mountId }));
