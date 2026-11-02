import { useMemo } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useSessions, useSessionStages } from '../../../../store';
import { usePinnedSessionIds } from '../../../../store/slices/session-pins/selectors';

const RAIL_PINNED_LIMIT = 7;

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

export type RailPinned = {
  readonly all: ReadonlyArray<Session>;
  readonly shown: ReadonlyArray<Session>;
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
  const stages = useSessionStages(active);
  return useMemo(() => {
    const byId = new Map(active.map((session) => [session.id as string, session]));

    const needs = active.filter((session) => stages[session.id] === 'attention');
    const running = active.filter((session) => stages[session.id] === 'running');
    const important = [...needs, ...running];
    const pins = pinnedIds.flatMap((id) => {
      const session = byId.get(id);
      return session === undefined || !active.includes(session) ? [] : [session];
    });
    const visible = Array.from(
      new Map([...important, ...pins].map((session) => [session.id, session])).values(),
    );
    const shown = visible.slice(0, RAIL_PINNED_LIMIT);
    const ordered = [...visible, ...active];
    const all = Array.from(
      new Map(
        ordered
          .filter((session) => active.includes(session))
          .map((session) => [session.id, session]),
      ).values(),
    );
    return { all, shown };
  }, [pinnedIds, active, stages]);
};
