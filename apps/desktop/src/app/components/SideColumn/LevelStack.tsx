import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { SidebarLevel } from '../../../store/slices/navigation/sidebarLevel';

export type LevelLayer = {
  readonly level: SidebarLevel;
  readonly node: ReactNode;
};

type Props = {
  readonly level: SidebarLevel;
  readonly layers: ReadonlyArray<LevelLayer>;
};

const DEPTH: Readonly<Record<SidebarLevel, number>> = { workspace: 0, session: 1, run: 2 };

const LAYER =
  'absolute inset-0 flex min-h-0 min-w-0 flex-col gap-1 motion-safe:transition-[opacity,transform,visibility] motion-safe:duration-180 motion-safe:ease-out';

type ShownParams = {
  readonly level: SidebarLevel;
  readonly layers: ReadonlyArray<LevelLayer>;
};

const shownLevelOf = ({ level, layers }: ShownParams): SidebarLevel => {
  const isPresent = layers.some((layer) => layer.level === level && layer.node !== null);
  return isPresent ? level : 'workspace';
};

type OffsetParams = {
  readonly layer: SidebarLevel;
  readonly shown: SidebarLevel;
};

const offsetClassOf = ({ layer, shown }: OffsetParams): string =>
  DEPTH[layer] < DEPTH[shown] ? '-translate-x-full' : 'translate-x-full';

export const LevelStack = ({ level, layers }: Props) => {
  const shown = shownLevelOf({ level, layers });
  return (
    <div data-level-stack={shown} className="relative min-h-0 flex-1 overflow-hidden">
      {layers.map((layer) => {
        if (layer.node === null) {
          return null;
        }
        const isShown = layer.level === shown;
        return (
          <div
            key={layer.level}
            data-level-layer={layer.level}
            inert={!isShown}
            style={{ visibility: isShown ? 'visible' : 'hidden' }}
            className={cn(
              LAYER,
              isShown
                ? 'opacity-100'
                : cn('pointer-events-none opacity-0', offsetClassOf({ layer: layer.level, shown })),
            )}
          >
            {layer.node}
          </div>
        );
      })}
    </div>
  );
};
