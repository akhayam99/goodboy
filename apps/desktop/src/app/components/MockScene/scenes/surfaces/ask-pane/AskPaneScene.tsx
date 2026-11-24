import { useCallback, useEffect } from 'react';
import type { LensKind } from '../../../../../../store';
import { useAppStore } from '../../../../../../store';
import { sessionPlace } from '../../../../../../store/slices/navigation/place';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { ActivityRunScene } from '../../ActivityRunScene';
import { SESSION } from '../../activityRunSeed';
import { seedSessionAsk, type AskSceneState } from '../../sessionAskSeed';

type Props = {
  readonly state: AskSceneState;
  readonly theme: 'dark' | 'light';
  readonly lens?: LensKind | null;
};

export const AskPaneScene = ({ state, theme, lens = null }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  const seed = useCallback(() => {
    seedSessionAsk({ state });
    if (lens !== null) {
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION.id, lens }) });
    }
  }, [lens, state]);
  return <ActivityRunScene onSeeded={seed} isPageFollowed />;
};
