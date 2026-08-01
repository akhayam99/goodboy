import type { SessionId } from '@goodboy/types';
import { resolveSessionRepo, type SessionRepo } from './resolveSessionRepo';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const getSessionRepo = ({ get, sessionId }: Params): SessionRepo | null => {
  return resolveSessionRepo({ state: get(), sessionId });
};
