import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore, useSessions } from '../../../../store';
import { cachedStageInfoOf } from '../../../../store/slices/session-view/cachedStageInfoOf';
import { usePinnedSessionIds } from '../../../../store/slices/session-pins/selectors';
import { railRankOf, type RailRank } from '../railRankOf';

const RAIL_PINNED_LIMIT = 7;

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

type RankParams = {
  readonly rank: RailRank;
};

export type RailPinned = {
  readonly all: ReadonlyArray<Session>;
  readonly shown: ReadonlyArray<Session>;
  readonly rest: ReadonlyArray<Session>;
};

export const useRailPinned = ({ workspaceId }: Params): RailPinned => {
  const pinnedIds = usePinnedSessionIds({ workspaceId });
  const sessions = useSessions();
  const active = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.workspaceId === workspaceId &&
          session.archivedAt == null &&
          session.deletedAt == null,
      ),
    [sessions, workspaceId],
  );
  const ranks = useAppStore(
    useShallow((state): Readonly<Record<string, RailRank>> =>
      Object.fromEntries(
        active.map((session) => [
          session.id,
          railRankOf({ info: cachedStageInfoOf({ state, session }) }),
        ]),
      ),
    ),
  );
  return useMemo(() => {
    const byId = new Map(active.map((session) => [session.id as string, session]));
    const ofRank = ({ rank }: RankParams) => active.filter((session) => ranks[session.id] === rank);
    const news = [
      ...ofRank({ rank: 'needs' }),
      ...ofRank({ rank: 'running' }),
      ...ofRank({ rank: 'unread' }),
    ];
    const pins = pinnedIds.flatMap((id) => {
      const session = byId.get(id);
      return session === undefined ? [] : [session];
    });
    const shown = news.slice(0, RAIL_PINNED_LIMIT);
    const all = Array.from(
      new Map([...news, ...pins, ...active].map((session) => [session.id, session])).values(),
    );
    const shownIds = new Set(shown.map((session) => session.id));
    const rest = all.filter((session) => !shownIds.has(session.id));
    return { all, shown, rest };
  }, [pinnedIds, active, ranks]);
};
