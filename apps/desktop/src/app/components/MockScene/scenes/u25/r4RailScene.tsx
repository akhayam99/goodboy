import { useCallback, useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import { openPaneOf } from '../../../../../features/session/panes/openPaneOf';
import { togglePane } from '../../../../../features/session/panes/togglePane';
import type { ClusterPane } from '../../../../../features/session/panes/clusterPane';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID } from '../activityRunSeed';
import { useSceneRailFold } from '../useSceneRailFold';
import { seedR4Rail } from './r4RailSeed';

export type R4RailState =
  'session' | 'cards-folded' | 'worktree' | 'tools-open' | 'narrow' | 'folded' | 'delete';

const BACKFILL_WORKTREE = '~/code/harborline/payments-api-backfill';

const NAVIGATE = useAppStore.getState().navigate;

const DELETE_TRIGGER = '[data-session-foot-action="session.delete"]';

const PANE_OF: Readonly<Partial<Record<R4RailState, ClusterPane>>> = {
  'tools-open': 'context',
  narrow: 'explore',
};

type PaneParams = {
  readonly pane: ClusterPane;
};

const openPane = ({ pane }: PaneParams): void => {
  if (openPaneOf({ state: useAppStore.getState(), sessionId: SESSION_ID }) === pane) {
    return;
  }
  togglePane({ sessionId: SESSION_ID, pane });
};

type Props = {
  readonly state: R4RailState;
};

export const R4RailScene = ({ state }: Props) => {
  useSceneRailFold({ isFolded: state === 'folded' });
  useEffect(
    () => () => {
      try {
        localStorage.removeItem(STORAGE_KEYS.sessionRailFoldedCards);
      } catch {
        return;
      }
    },
    [],
  );
  useEffect(() => {
    if (state !== 'worktree') {
      return;
    }
    const timer = window.setTimeout(() => {
      NAVIGATE({
        to: branchPlace({ sessionId: SESSION_ID, mountPath: BACKFILL_WORKTREE, tab: 'files' }),
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (state !== 'delete') {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(DELETE_TRIGGER)?.click();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [state]);
  const seed = useCallback(() => {
    seedR4Rail({ isCardFolded: state === 'cards-folded' });
    const pane = PANE_OF[state];
    if (pane !== undefined) {
      openPane({ pane });
    }
  }, [state]);
  return <ActivityRunScene onSeeded={seed} isPageFollowed />;
};
