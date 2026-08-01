import type { SessionId } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store';
import { resolveSessionRepo, type SessionRepo } from './resolveSessionRepo';

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionRepo = ({ sessionId }: Params): SessionRepo | null => {
  return useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
};
