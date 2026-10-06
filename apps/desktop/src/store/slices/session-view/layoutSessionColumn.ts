import type { Session, SessionId, SessionStage, SessionViewPrefs } from '@goodboy/types';
import { foldSessions } from './foldSessions';
import { isSessionGroupCollapsed } from './isSessionGroupCollapsed';
import type { GroupedSessions } from './types';

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

type Params = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly prefs: SessionViewPrefs;
  readonly groupExpanded: Readonly<Record<string, boolean>>;
  readonly currentSessionId: SessionId | null;
  readonly stageBySession: Readonly<Record<SessionId, SessionStage>>;
};

export const layoutSessionColumn = ({
  groups,
  prefs,
  groupExpanded,
  currentSessionId,
  stageBySession,
}: Params): SessionColumnLayout => {
  const isGrouped = prefs.group !== 'none';
  const columnGroups = groups
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
        label: null,
        isCollapsed: false,
        total: group.sessions.length,
        sessions: folded.visible,
      };
    });
  const hiddenCount = columnGroups.reduce(
    (sum, group) => sum + group.total - group.sessions.length,
    0,
  );
  const order = columnGroups
    .filter((group) => !group.isCollapsed)
    .flatMap((group) => group.sessions.map((session) => session.id as SessionId));
  return { isGrouped, groups: columnGroups, hiddenCount, order };
};
