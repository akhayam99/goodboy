import type { ReactNode, Ref } from 'react';
import { cn } from '@goodboy/ui';
import type { RailLevel } from '../../../store/slices/navigation/railLevel';
import { LEVEL_LAYER } from './levelLayerClass';
import type { LevelDirection } from './useLevelSwap';

type Props = {
  readonly name: RailLevel;
  readonly isShown: boolean;
  readonly entry: LevelDirection | null;
  readonly layerRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
};

const ENTRY: Readonly<Record<LevelDirection, string>> = {
  forward: 'motion-safe:animate-level-in-forward',
  back: 'motion-safe:animate-level-in-back',
};

export const LevelLayer = ({ name, isShown, entry, layerRef, children }: Props) => (
  <div
    ref={layerRef}
    data-level-layer={name}
    data-level-entry={isShown && entry !== null ? entry : undefined}
    inert={!isShown}
    style={{ visibility: isShown ? 'visible' : 'hidden' }}
    className={cn(
      LEVEL_LAYER,
      !isShown && 'pointer-events-none',
      isShown && entry !== null && ENTRY[entry],
    )}
  >
    {children}
  </div>
);
