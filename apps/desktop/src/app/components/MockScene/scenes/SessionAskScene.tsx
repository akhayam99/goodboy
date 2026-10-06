import { useCallback, useEffect } from 'react';
import { ActivityRunScene } from './ActivityRunScene';
import { sceneParam } from './audit/sceneParams';
import { ASK_SCENE_STATES, seedSessionAsk, type AskSceneState } from './sessionAskSeed';

const stateFromUrl = (): AskSceneState =>
  ASK_SCENE_STATES.find((state) => state === sceneParam({ key: 'state' })) ?? 'rightnow';

const PLAN_CHIP_DELAY_MS = 50;

export const SessionAskScene = () => {
  const state = stateFromUrl();
  const seed = useCallback(() => seedSessionAsk({ state }), [state]);

  useEffect(() => {
    if (state !== 'plan') {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-ask-kind="artifact"] button')?.click();
    }, PLAN_CHIP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  return <ActivityRunScene onSeeded={seed} isPageFollowed />;
};
