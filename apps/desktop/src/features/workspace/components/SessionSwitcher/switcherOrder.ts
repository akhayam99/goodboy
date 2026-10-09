import type { Session, SessionId } from '@goodboy/types';
import { recentlyOpenedFirst } from '../../../../store/slices/session-view/sortAndGroupSessions';

const SWITCHER_LIST_LIMIT = 8;

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly currentSessionId: SessionId | null;
  readonly pinnedIds: ReadonlyArray<SessionId>;
};

export type SwitcherOrder = {
  readonly ids: ReadonlyArray<SessionId>;
  readonly pinnedCount: number;
  readonly previousIndex: number;
};

export const switcherOrderOf = ({
  sessions,
  currentSessionId,
  pinnedIds,
}: Params): SwitcherOrder => {
  const recent = recentlyOpenedFirst(sessions).map((session) => session.id as SessionId);
  const current = recent.find((id) => id === currentSessionId);
  const rest = recent.filter((id) => id !== current);
  const live = new Set(recent);
  const pinned = [...new Set(pinnedIds)].filter((id) => live.has(id)).slice(0, SWITCHER_LIST_LIMIT);
  const recents = (current === undefined ? rest : [current, ...rest])
    .filter((id) => !pinned.includes(id))
    .slice(0, SWITCHER_LIST_LIMIT);
  const ids = [...pinned, ...recents];
  const previous = rest[0];
  const previousIndex = previous === undefined ? -1 : ids.indexOf(previous);
  return { ids, pinnedCount: pinned.length, previousIndex };
};
