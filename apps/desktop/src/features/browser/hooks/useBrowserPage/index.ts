import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { browserPageGroups } from '../../browserPageGroups';
import { browserPinProjectIds } from '../../browserPinProjectIds';
import { browserScopeSessions } from '../../browserScopeSessions';
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
  const sessions = useAppStore(useShallow((state) => browserScopeSessions({ state })));
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
  const projectIds = useMemo(() => browserPinProjectIds({ projectOf }), [projectOf]);
  const pinsOf = useAppStore(
    useShallow((state) => projectIds.map((id) => state.browserProjectPins[id] ?? NO_TABS)),
  );
  const namesOf = useAppStore(
    useShallow((state) => projectIds.map((id) => projectById(state.projects, id)?.name ?? '')),
  );
  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);

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
    const pins = projectIds.map((projectId, index) => ({
      projectId,
      projectName: namesOf[index] ?? '',
      pins: pinsOf[index] ?? NO_TABS,
    }));
    const pinned = new Set(
      pins.filter((project) => project.pins.length > 0).map((project) => project.projectId),
    );
    const isKnown = rows.some((row) => row.sessionId === sessionId);
    const firstHost =
      rows.find((row) => row.tabs.length > 0) ??
      rows.find((row) => row.projectId !== null && pinned.has(row.projectId));
    const selectedId = isKnown ? sessionId : (firstHost?.sessionId ?? null);
    return { groups: browserPageGroups({ sessions: rows, pins, selectedId }), selectedId };
  }, [sessions, projectOf, tabsOf, projectIds, pinsOf, namesOf, sessionId]);
};
