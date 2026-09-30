import type { SessionTitleRef } from '@goodboy/db';
import type { Session, SessionId, Workspace, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { formatAge } from '../../../shared/utils/time/formatAge';
import { sessionTitle } from '../../session/sessionTitle';
import type { PaletteEntry } from '../types';

export type SessionOpenParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly otherSessions: ReadonlyArray<SessionTitleRef>;
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly projectNames: ReadonlyMap<string, string>;
  readonly now: number;
  readonly open: (params: SessionOpenParams) => void;
};

const sessionKey = (sessionId: string): string => `session:${sessionId}`;

export const sessionEntries = ({
  sessions,
  otherSessions,
  workspaces,
  currentWorkspaceId,
  projectNames,
  now,
  open,
}: Params): ReadonlyArray<PaletteEntry> => {
  const nameOf = (workspaceId: string): string =>
    workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? '';
  const local = sessions
    .filter((session) => session.archivedAt == null)
    .map((session): PaletteEntry => {
      const sessionId = session.id as SessionId;
      const workspaceId = session.workspaceId as WorkspaceId;
      const project = projectNames.get(sessionId) ?? null;
      const age = formatAge({ from: session.updatedAt, now });
      return {
        key: sessionKey(sessionId),
        label: sessionTitle({ session }),
        secondary: [project ?? '', nameOf(workspaceId)].filter((text) => text !== ''),
        kind: 'session',
        group: 'session',
        icon: CONCEPT_ICONS.sessions,
        detail: [project, age].filter((part) => part !== null && part !== '').join(' · '),
        tag: 'Session',
        target: { kind: 'session', sessionId },
        run: () => open({ sessionId, workspaceId }),
      };
    });
  const localIds = new Set(sessions.map((session) => session.id));
  const others = otherSessions
    .filter((ref) => ref.workspaceId !== currentWorkspaceId && !localIds.has(ref.sessionId))
    .map((ref): PaletteEntry => {
      const workspace = nameOf(ref.workspaceId);
      const age = formatAge({ from: ref.updatedAt, now });
      return {
        key: sessionKey(ref.sessionId),
        label: sessionTitle({ session: ref }),
        secondary: workspace === '' ? [] : [workspace],
        kind: 'session',
        group: 'session',
        icon: CONCEPT_ICONS.sessions,
        detail: [workspace, age].filter((part) => part !== '').join(' · '),
        tag: 'Session',
        run: () => open({ sessionId: ref.sessionId, workspaceId: ref.workspaceId }),
      };
    });
  return [...local, ...others];
};
