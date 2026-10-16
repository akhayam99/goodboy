import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { SidebarLevel } from '../../../store/slices/navigation/sidebarLevel';

type Props = {
  readonly name: SidebarLevel;
  readonly depth: number;
  readonly shownDepth: number;
  readonly children: ReactNode;
};

const LAYER =
  'absolute inset-0 flex min-h-0 min-w-0 flex-col gap-1 motion-safe:transition-[opacity,transform,visibility] motion-safe:duration-180 motion-safe:ease-out';

export const LevelLayer = ({ name, depth, shownDepth, children }: Props) => {
  const isShown = depth === shownDepth;
  return (
    <div
      data-level-layer={name}
      inert={!isShown}
      style={{ visibility: isShown ? 'visible' : 'hidden' }}
      className={cn(
        LAYER,
        isShown && 'opacity-100',
        depth < shownDepth && 'pointer-events-none -translate-x-full opacity-0',
        depth > shownDepth && 'pointer-events-none translate-x-full opacity-0',
      )}
    >
      {children}
    </div>
  );
};
