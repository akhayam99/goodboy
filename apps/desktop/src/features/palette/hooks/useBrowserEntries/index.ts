import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { browserPageData } from '../../../browser/browserPageData';
import { browserPinProjectIds } from '../../../browser/browserPinProjectIds';
import { browserScopeSessions } from '../../../browser/browserScopeSessions';
import { pinProjectOf } from '../../../browser/pinProjectOf';
import { browserOpenEntries } from '../../sources/browserOpenEntries';
import { browserTabEntries } from '../../sources/browserTabEntries';
import type { PaletteEntry } from '../../types';

type Params = {
  readonly query: string;
  readonly scopeSessionId: SessionId | null;
};

type BrowserEntries = {
  readonly opens: ReadonlyArray<PaletteEntry>;
  readonly tabs: ReadonlyArray<PaletteEntry>;
};

const NO_TABS: ReadonlyArray<BrowserTab> = [];

export const useBrowserEntries = ({ query, scopeSessionId }: Params): BrowserEntries => {
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const sessionId = scopeSessionId ?? currentSessionId;
  const sessions = useAppStore(useShallow((state) => browserScopeSessions({ state })));
  const tabsOf = useAppStore(
    useShallow((state) =>
      sessions.map((session) => state.browserSessionTabs[session.id] ?? NO_TABS),
    ),
  );
  const isLoadedOf = useAppStore(
    useShallow((state) =>
      sessions.map((session) => state.browserSessionTabs[session.id] !== undefined),
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

  useEffect(() => {
    const state = useAppStore.getState();
    sessions.forEach((session, index) => {
      if (isLoadedOf[index] !== true) {
        void state.loadBrowserSessionTabs({ sessionId: session.id });
      }
    });
  }, [sessions, isLoadedOf]);

  useEffect(() => {
    const state = useAppStore.getState();
    for (const projectId of projectIds) {
      if (state.browserProjectPins[projectId] === undefined) {
        void state.loadBrowserProjectPins({ projectId });
      }
    }
  }, [projectIds]);

  const tabs = useMemo(
    () =>
      browserTabEntries({
        groups: browserPageData({
          sessionId,
          sessions,
          projectOf,
          tabsOf,
          projectIds,
          pinsOf,
          namesOf,
        }).groups,
      }),
    [sessionId, sessions, projectOf, tabsOf, projectIds, pinsOf, namesOf],
  );
  const opens = useMemo(() => browserOpenEntries({ query, sessionId }), [query, sessionId]);
  return useMemo(() => ({ opens, tabs }), [opens, tabs]);
};
