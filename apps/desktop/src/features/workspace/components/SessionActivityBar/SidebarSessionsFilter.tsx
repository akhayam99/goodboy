import { useCallback, useMemo } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessions, useSessionViewPrefs } from '../../../../store';
import { SessionFilterPopover } from './SessionFilterPopover';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const SidebarSessionsFilter = ({ workspaceId }: Props) => {
  const sessions = useSessions();
  const archived: ReadonlyArray<Session> = useAppStore(
    (s) => s.archivedSessions[workspaceId] ?? EMPTY_ARRAY,
  );
  const prefs = useSessionViewPrefs(workspaceId);
  const setSessionViewPrefs = useAppStore((s) => s.setSessionViewPrefs);
  const filterSessions = useMemo(
    () => (prefs.isArchivedShown ? [...sessions, ...archived] : sessions),
    [archived, prefs.isArchivedShown, sessions],
  );
  const setArchivedShown = useCallback(
    (isShown: boolean) => setSessionViewPrefs({ workspaceId, patch: { isArchivedShown: isShown } }),
    [setSessionViewPrefs, workspaceId],
  );
  return (
    <SessionFilterPopover
      workspaceId={workspaceId}
      sessions={filterSessions}
      archivedCount={archived.length}
      onArchivedShownChange={setArchivedShown}
    />
  );
};
