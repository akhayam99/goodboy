import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { resolveSessionRepo, type SessionRepo } from './resolveSessionRepo';

type Params = {
  readonly sessionId: SessionId;
};

export const useSessionRepo = ({ sessionId }: Params): SessionRepo | null => {
  return useAppStore((state) => resolveSessionRepo({ state, sessionId }));
};
