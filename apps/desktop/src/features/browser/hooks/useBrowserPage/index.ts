import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { browserPageGroups } from '../../browserPageGroups';
import { pinProjectOf } from '../../pinProjectOf';
import type { BrowserPageGroup } from '../../types';

type Params = {
  readonly sessionId: SessionId | null;
};

type BrowserPage = {
  readonly groups: ReadonlyArray<BrowserPageGroup>;
  readonly selectedId: SessionId | null;
};

const NO_TABS: ReadonlyArray<BrowserTab> = [];

export const useBrowserPage = ({ sessionId }: Params): BrowserPage => {
  const sessions = useAppStore((state) => state.sessions);
  const tabsOf = useAppStore(
    useShallow((state) =>
      sessions.map((session) => state.browserSessionTabs[session.id] ?? NO_TABS),
    ),
  );
  const projectOf = useAppStore(
    useShallow((state) =>
      sessions.map((session) => pinProjectOf({ state, sessionId: session.id })),
    ),
  );
  const projectIds = useMemo(
    () => Array.from(new Set(projectOf.filter((id): id is ProjectId => id !== null))).sort(),
    [projectOf],
  );
  const pinsOf = useAppStore(
    useShallow((state) => projectIds.map((id) => state.browserProjectPins[id] ?? NO_TABS)),
  );
  const namesOf = useAppStore(
    useShallow((state) => projectIds.map((id) => projectById(state.projects, id)?.name ?? '')),
  );
  const sessionIds = useAppStore(
    useShallow((state) => state.sessions.map((session) => session.id)),
  );

  useEffect(() => {
    const state = useAppStore.getState();
    for (const id of sessionIds) {
      void state.loadBrowserSessionTabs({ sessionId: id });
    }
  }, [sessionIds]);

  useEffect(() => {
    const state = useAppStore.getState();
    for (const projectId of projectIds) {
      void state.loadBrowserProjectPins({ projectId });
    }
  }, [projectIds]);

  return useMemo(() => {
    const rows = sessions.map((session, index) => ({
      sessionId: session.id,
      title: sessionTitle({ session }),
      projectId: projectOf[index] ?? null,
      tabs: tabsOf[index] ?? NO_TABS,
    }));
    const isKnown = rows.some((row) => row.sessionId === sessionId);
    const selectedId = isKnown
      ? sessionId
      : (rows.find((row) => row.tabs.length > 0)?.sessionId ?? null);
    const pins = projectIds.map((projectId, index) => ({
      projectId,
      projectName: namesOf[index] ?? '',
      pins: pinsOf[index] ?? NO_TABS,
    }));
    return { groups: browserPageGroups({ sessions: rows, pins, selectedId }), selectedId };
  }, [sessions, projectOf, tabsOf, projectIds, pinsOf, namesOf, sessionId]);
};
