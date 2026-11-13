import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { browserPageData, type BrowserPageData } from '../../browserPageData';
import { browserPinProjectIds } from '../../browserPinProjectIds';
import { browserScopeSessions } from '../../browserScopeSessions';
import { pinProjectOf } from '../../pinProjectOf';

type Params = {
  readonly sessionId: SessionId | null;
};

const NO_TABS: ReadonlyArray<BrowserTab> = [];

export const useBrowserPage = ({ sessionId }: Params): BrowserPageData => {
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

  return useMemo(
    () => browserPageData({ sessionId, sessions, projectOf, tabsOf, projectIds, pinsOf, namesOf }),
    [sessions, projectOf, tabsOf, projectIds, pinsOf, namesOf, sessionId],
  );
};
