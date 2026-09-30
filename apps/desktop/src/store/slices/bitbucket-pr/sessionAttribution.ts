import type { SessionId } from '@goodboy/types';
import { isAttributionEnabled } from '../../../shared/utils/attribution';
import type { GetFn } from '../../slice-types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const isSessionAttributionEnabled = ({ get, sessionId }: Params): boolean => {
  const session = sessionById(get().sessions, sessionId);
  if (session == null) {
    return isAttributionEnabled({ overrides: null });
  }
  return isAttributionEnabled({ overrides: get().workspaceOverrides[session.workspaceId] });
};
