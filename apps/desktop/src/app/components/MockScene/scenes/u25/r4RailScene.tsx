import { useCallback, useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { STORAGE_KEYS } from '../../../../../shared/lib/storage-keys';
import { openPaneOf } from '../../../../../features/session/panes/openPaneOf';
import { togglePane } from '../../../../../features/session/panes/togglePane';
import type { ClusterPane } from '../../../../../features/session/panes/clusterPane';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID } from '../activityRunSeed';
import { seedR4Rail } from './r4RailSeed';
import { pickSessionMenuItem } from '../pickSessionMenuItem';

export type R4RailState = 'session' | 'cards-folded' | 'tools-open' | 'narrow' | 'delete' | 'tree';

const PICK_INTERVAL_MS = 50;

const CARD_STATES: ReadonlySet<R4RailState> = new Set<R4RailState>([
  'session',
  'cards-folded',
  'tree',
]);

const PANE_OF: Readonly<Partial<Record<R4RailState, ClusterPane>>> = {
  'tools-open': 'context',
  narrow: 'explore',
};

type PaneParams = {
  readonly pane: ClusterPane;
};

const openPane = ({ pane }: PaneParams): void => {
  if (pane === 'ask' || pane === 'context') {
    useAppStore.setState({ navigate: useAppStore.getInitialState().navigate });
  }
  if (openPaneOf({ state: useAppStore.getState(), sessionId: SESSION_ID }) === pane) {
    return;
  }
  togglePane({ sessionId: SESSION_ID, pane });
};

type Props = {
  readonly state: R4RailState;
};

export const R4RailScene = ({ state }: Props) => {
  useEffect(
    () => () => {
      try {
        localStorage.removeItem(STORAGE_KEYS.sessionRailFoldedCards);
        localStorage.removeItem(STORAGE_KEYS.sessionRailTreeOpen);
      } catch {
        return;
      }
    },
    [],
  );
  useEffect(() => {
    if (state !== 'delete') {
      return;
    }
    const timer = window.setInterval(() => {
      if (pickSessionMenuItem({ label: 'Delete' })) {
        window.clearInterval(timer);
      }
    }, PICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [state]);
  const seed = useCallback(() => {
    seedR4Rail({
      isCardFolded: state === 'cards-folded',
      hasManyBranches: state === 'tree',
    });
    if (CARD_STATES.has(state)) {
      useAppStore.setState((current) => ({
        activeLens: { ...current.activeLens, [SESSION_ID]: 'context' },
      }));
    }
    const pane = PANE_OF[state];
    if (pane !== undefined) {
      openPane({ pane });
    }
  }, [state]);
  return <ActivityRunScene onSeeded={seed} isPageFollowed />;
};
