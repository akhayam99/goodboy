import { useRef, type ReactNode } from 'react';
import type { RailLevel } from '../../../store/slices/navigation/railLevel';
import { LevelGhost } from './LevelGhost';
import { LevelLayer } from './LevelLayer';
import { useLevelSwap } from './useLevelSwap';

type StackLayer = {
  readonly level: RailLevel;
  readonly node: ReactNode;
};

type Props = {
  readonly level: RailLevel;
  readonly layers: ReadonlyArray<StackLayer>;
};

type ShownParams = Props;

const isPresentIn = ({ level, layers }: ShownParams): boolean =>
  layers.some((layer) => layer.level === level && layer.node !== null);

const shownLevelOf = ({ level, layers }: ShownParams): RailLevel =>
  isPresentIn({ level, layers }) ? level : 'session';

export const LevelStack = ({ level, layers }: Props) => {
  const shown = shownLevelOf({ level, layers });
  const elementsRef = useRef(new Map<RailLevel, HTMLElement>());
  const swap = useLevelSwap({ shown, elementsRef });
  return (
    <div data-level-stack={shown} className="relative min-h-0 flex-1 overflow-clip">
      {layers.map((layer) => {
        if (layer.node === null) {
          return null;
        }
        const isShown = layer.level === shown;
        return (
          <LevelLayer
            key={layer.level}
            name={layer.level}
            isShown={isShown}
            entry={isShown ? swap.entry : null}
            layerRef={(node) => {
              if (node === null) {
                elementsRef.current.delete(layer.level);
                return;
              }
              elementsRef.current.set(layer.level, node);
            }}
          >
            {layer.node}
          </LevelLayer>
        );
      })}
      {swap.ghost === null ? null : <LevelGhost key={swap.ghost.id} ghost={swap.ghost} />}
    </div>
  );
};
