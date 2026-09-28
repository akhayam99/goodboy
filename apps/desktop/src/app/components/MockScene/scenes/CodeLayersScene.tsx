import { useEffect, useState } from 'react';
import { AppFrame } from './audit/AppFrame';
import { sceneParam } from './audit/sceneParams';
import {
  CODE_LAYERS,
  PR_SCENE_STATES,
  WORKTREE_SCENE_STATES,
  seedCodeLayers,
  type CodeLayer,
  type PrSceneState,
  type WorktreeSceneState,
} from './codeLayersSeed';

const pick = <T extends string>({
  key,
  values,
  fallback,
}: {
  readonly key: string;
  readonly values: ReadonlyArray<T>;
  readonly fallback: T;
}): T => values.find((value) => value === sceneParam({ key })) ?? fallback;

const LAYER: CodeLayer = pick({ key: 'layer', values: CODE_LAYERS, fallback: 'overview' });
const PR_STATE: PrSceneState = pick({ key: 'pr', values: PR_SCENE_STATES, fallback: 'failing' });
const WORKTREE_STATE: WorktreeSceneState = pick({
  key: 'wt',
  values: WORKTREE_SCENE_STATES,
  fallback: 'open',
});

export const CodeLayersScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedCodeLayers({ layer: LAYER, prState: PR_STATE, worktreeState: WORKTREE_STATE });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <AppFrame view="session" isRailCollapsed />;
};
