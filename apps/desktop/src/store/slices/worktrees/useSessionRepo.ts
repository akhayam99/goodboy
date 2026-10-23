import type { MountId, SessionId } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store';
import { resolveSessionRepo, type SessionRepo } from './resolveSessionRepo';

type Params = {
  readonly sessionId: SessionId | null;
  readonly mountId?: MountId | null;
};

export const useSessionRepo = ({ sessionId, mountId = null }: Params): SessionRepo | null => {
  return useAppStore(
    useShallow((state) =>
      sessionId === null
        ? null
        : resolveSessionRepo({ state, sessionId, ...(mountId === null ? {} : { mountId }) }),
    ),
  );
};
