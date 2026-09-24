import { useEffect } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { ImpactScene } from '../ImpactScene';
import { sceneParam } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';

const IS_EMPTY = (sceneParam({ key: 'v' }) ?? 'empty') === 'empty';
const SCOPES: ReadonlyArray<string> = [sceneParam({ key: 'scope' }) ?? 'Overview'];

export const ImpactScopesScene = () => {
  useEffect(() => {
    if (!IS_EMPTY) {
      return;
    }
    mockIPC(() => []);
  }, []);
  useSceneClicks({
    isReady: true,
    labels: SCOPES,
    selector: '[data-studio-overlay] button',
    match: 'prefix',
    intervalMs: 200,
  });
  return <ImpactScene />;
};
