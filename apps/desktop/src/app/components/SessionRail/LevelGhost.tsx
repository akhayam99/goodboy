import { useCallback } from 'react';
import { cn, mountExitSnapshot } from '@goodboy/ui';
import { LEVEL_LAYER } from './levelLayerClass';
import type { LevelDirection, LevelGhostModel } from './useLevelSwap';

type Props = {
  readonly ghost: LevelGhostModel;
};

const EXIT: Readonly<Record<LevelDirection, string>> = {
  forward: 'motion-safe:animate-level-out-forward',
  back: 'motion-safe:animate-level-out-back',
};

export const LevelGhost = ({ ghost }: Props) => {
  const mount = useCallback(
    (host: HTMLDivElement | null) => {
      if (host === null || host.childElementCount > 0) {
        return;
      }
      const node = ghost.snapshot.node;
      node.removeAttribute('data-level-layer');
      node.removeAttribute('data-level-entry');
      node.removeAttribute('style');
      node.className = LEVEL_LAYER;
      mountExitSnapshot({ host, snapshot: ghost.snapshot });
    },
    [ghost],
  );
  return (
    <div
      ref={mount}
      aria-hidden
      inert
      data-level-ghost={ghost.direction}
      className={cn('pointer-events-none absolute inset-0', EXIT[ghost.direction])}
    />
  );
};
