import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { SidebarLevel } from '../../../store/slices/navigation/sidebarLevel';

type Props = {
  readonly layer: SidebarLevel;
  readonly shown: SidebarLevel;
  readonly children: ReactNode;
};

const LAYER =
  'absolute inset-0 flex min-h-0 min-w-0 flex-col gap-1 motion-safe:transition-[opacity,transform,visibility] motion-safe:duration-180 motion-safe:ease-out';

const DEPTH: Readonly<Record<SidebarLevel, number>> = { workspace: 0, session: 1, auto: 2 };

export const LevelLayer = ({ layer, shown, children }: Props) => {
  const isShown = layer === shown;
  const isBehind = DEPTH[layer] < DEPTH[shown];
  return (
    <div
      data-level-layer={layer}
      inert={!isShown}
      style={{ visibility: isShown ? 'visible' : 'hidden' }}
      className={cn(
        LAYER,
        isShown && 'opacity-100',
        !isShown && 'pointer-events-none opacity-0',
        !isShown && isBehind && '-translate-x-full',
        !isShown && !isBehind && 'translate-x-full',
      )}
    >
      {children}
    </div>
  );
};
