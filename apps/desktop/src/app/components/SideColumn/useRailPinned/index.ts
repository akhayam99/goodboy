import { useMemo } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useSessions } from '../../../../store';
import { usePinnedSessionIds } from '../../../../store/slices/session-pins/selectors';

export const RAIL_PINNED_LIMIT = 7;

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export type RailPinned = {
  readonly all: ReadonlyArray<Session>;
};

export const useRailPinned = ({ workspaceId }: Params): RailPinned => {
  const pinnedIds = usePinnedSessionIds({ workspaceId });
  const sessions = useSessions();
  return useMemo(() => {
    const byId = new Map(sessions.map((session) => [session.id as string, session]));
    return {
      all: pinnedIds.flatMap((id) => {
        const session = byId.get(id);
        return session === undefined ? [] : [session];
      }),
    };
  }, [pinnedIds, sessions]);
};
