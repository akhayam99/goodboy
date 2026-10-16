import type { ReactNode } from 'react';
import type { SidebarLevel } from '../../../store/slices/navigation/sidebarLevel';
import { LevelLayer, type LevelLayerPosition } from './LevelLayer';

type StackLayer = {
  readonly level: SidebarLevel;
  readonly node: ReactNode;
};

type Props = {
  readonly level: SidebarLevel;
  readonly layers: ReadonlyArray<StackLayer>;
};

const DEPTH: Readonly<Record<SidebarLevel, number>> = {
  workspace: 0,
  session: 1,
  worktree: 2,
  run: 2,
  auto: 2,
};

type ShownParams = Props;

const isPresentIn = ({ level, layers }: ShownParams): boolean =>
  layers.some((layer) => layer.level === level && layer.node !== null);

const shownLevelOf = ({ level, layers }: ShownParams): SidebarLevel => {
  if (isPresentIn({ level, layers })) {
    return level;
  }
  if (DEPTH[level] > DEPTH.session && isPresentIn({ level: 'session', layers })) {
    return 'session';
  }
  return 'workspace';
};

type PositionParams = {
  readonly layer: SidebarLevel;
  readonly shown: SidebarLevel;
};

const positionOf = ({ layer, shown }: PositionParams): LevelLayerPosition => {
  if (layer === shown) {
    return 'shown';
  }
  return DEPTH[layer] < DEPTH[shown] ? 'before' : 'after';
};

export const LevelStack = ({ level, layers }: Props) => {
  const shown = shownLevelOf({ level, layers });
  return (
    <div data-level-stack={shown} className="relative min-h-0 flex-1 overflow-hidden">
      {layers.map((layer) => {
        if (layer.node === null) {
          return null;
        }
        return (
          <LevelLayer
            key={layer.level}
            name={layer.level}
            position={positionOf({ layer: layer.level, shown })}
          >
            {layer.node}
          </LevelLayer>
        );
      })}
    </div>
  );
};
