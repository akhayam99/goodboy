import type { Session, SessionId, SessionStage, SessionViewPrefs } from '@goodboy/types';
import { foldSessions } from './foldSessions';
import { isSessionGroupCollapsed } from './isSessionGroupCollapsed';
import { PINNED_GROUP_KEY, type GroupedSessions } from './types';

type ColumnGroup = {
  readonly key: string;
  readonly label: string | null;
  readonly isCollapsed: boolean;
  readonly total: number;
  readonly sessions: ReadonlyArray<Session>;
};

export type SessionColumnLayout = {
  readonly isGrouped: boolean;
  readonly groups: ReadonlyArray<ColumnGroup>;
  readonly hiddenCount: number;
  readonly order: ReadonlyArray<SessionId>;
};

const OTHER_SESSIONS_LABEL = 'Other sessions';

type Params = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly prefs: SessionViewPrefs;
  readonly groupExpanded: Readonly<Record<string, boolean>>;
  readonly currentSessionId: SessionId | null;
  readonly stageBySession: Readonly<Record<SessionId, SessionStage>>;
  readonly pinnedIds: ReadonlyArray<SessionId>;
};

type PinnedParams = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly pinnedIds: ReadonlyArray<SessionId>;
};

type Split = {
  readonly pinned: ReadonlyArray<Session>;
  readonly rest: ReadonlyArray<GroupedSessions>;
};

const splitPinned = ({ groups, pinnedIds }: PinnedParams): Split => {
  if (pinnedIds.length === 0) {
    return { pinned: [], rest: groups };
  }
  const listed = new Map<string, Session>();
  for (const group of groups) {
    for (const session of group.sessions) {
      listed.set(session.id, session);
    }
  }
  const seen = new Set<string>();
  const pinned: Session[] = [];
  for (const id of pinnedIds) {
    const session = listed.get(id);
    if (session === undefined || seen.has(id)) {
      continue;
    }
    seen.add(id);
    pinned.push(session);
  }
  return {
    pinned,
    rest: groups.map((group) => ({
      ...group,
      sessions: group.sessions.filter((session) => !seen.has(session.id)),
    })),
  };
};

export const layoutSessionColumn = ({
  groups,
  prefs,
  groupExpanded,
  currentSessionId,
  stageBySession,
  pinnedIds,
}: Params): SessionColumnLayout => {
  const isGrouped = prefs.group !== 'none';
  const { pinned, rest } = splitPinned({ groups, pinnedIds });
  const listedGroups = rest
    .filter((group) => group.sessions.length > 0)
    .map((group): ColumnGroup => {
      if (isGrouped) {
        return {
          key: group.key,
          label: group.label ?? null,
          isCollapsed: isSessionGroupCollapsed({ key: group.key, overrides: groupExpanded }),
          total: group.sessions.length,
          sessions: group.sessions,
        };
      }
      const folded = foldSessions({
        sessions: group.sessions,
        isFoldOpen: prefs.isFoldOpen,
        isAlwaysShown: (session) =>
          session.id === currentSessionId ||
          stageBySession[session.id as SessionId] === 'attention',
      });
      return {
        key: group.key,
        label: pinned.length === 0 ? null : OTHER_SESSIONS_LABEL,
        isCollapsed: false,
        total: group.sessions.length,
        sessions: folded.visible,
      };
    });
  const hiddenCount = listedGroups.reduce(
    (sum, group) => sum + group.total - group.sessions.length,
    0,
  );
  const columnGroups: ReadonlyArray<ColumnGroup> =
    pinned.length === 0
      ? listedGroups
      : [
          {
            key: PINNED_GROUP_KEY,
            label: 'Pinned',
            isCollapsed:
              isGrouped &&
              isSessionGroupCollapsed({ key: PINNED_GROUP_KEY, overrides: groupExpanded }),
            total: pinned.length,
            sessions: pinned,
          },
          ...listedGroups,
        ];
  const order = columnGroups
    .filter((group) => !group.isCollapsed)
    .flatMap((group) => group.sessions.map((session) => session.id as SessionId));
  return { isGrouped, groups: columnGroups, hiddenCount, order };
};
