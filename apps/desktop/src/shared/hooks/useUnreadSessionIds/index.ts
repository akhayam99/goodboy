import { useShallow } from 'zustand/react/shallow';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionHasUnread } from '../../../store/slices/session-view/sessionHasUnread';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
};

export const useUnreadSessionIds = ({ sessions }: Params): ReadonlyArray<SessionId> =>
  useAppStore(
    useShallow((state) =>
      sessions
        .filter((session) => session.archivedAt == null)
        .filter((session) => sessionHasUnread({ state, sessionId: session.id }))
        .map((session) => session.id),
    ),
  );
