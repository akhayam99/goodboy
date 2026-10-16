import type { ReactNode } from 'react';
import type { RailLevel } from '../../../store/slices/navigation/railLevel';
import { LevelLayer, type LevelLayerPosition } from './LevelLayer';

type StackLayer = {
  readonly level: RailLevel;
  readonly node: ReactNode;
};

type Props = {
  readonly level: RailLevel;
  readonly layers: ReadonlyArray<StackLayer>;
};

const DEPTH: Readonly<Record<RailLevel, number>> = {
  session: 0,
  worktree: 1,
  run: 1,
  auto: 1,
};

type ShownParams = Props;

const isPresentIn = ({ level, layers }: ShownParams): boolean =>
  layers.some((layer) => layer.level === level && layer.node !== null);

const shownLevelOf = ({ level, layers }: ShownParams): RailLevel =>
  isPresentIn({ level, layers }) ? level : 'session';

type PositionParams = {
  readonly layer: RailLevel;
  readonly shown: RailLevel;
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
