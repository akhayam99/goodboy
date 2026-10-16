import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { SidebarLevel } from '../../../store/slices/navigation/sidebarLevel';

export type LevelLayerPosition = 'shown' | 'before' | 'after';

type Props = {
  readonly name: SidebarLevel;
  readonly position: LevelLayerPosition;
  readonly children: ReactNode;
};

const LAYER =
  'absolute inset-0 flex min-h-0 min-w-0 flex-col gap-1 motion-safe:transition-[opacity,transform,visibility] motion-safe:duration-180 motion-safe:ease-out';

export const LevelLayer = ({ name, position, children }: Props) => {
  const isShown = position === 'shown';
  return (
    <div
      data-level-layer={name}
      inert={!isShown}
      style={{ visibility: isShown ? 'visible' : 'hidden' }}
      className={cn(
        LAYER,
        isShown && 'opacity-100',
        position === 'before' && 'pointer-events-none -translate-x-full opacity-0',
        position === 'after' && 'pointer-events-none translate-x-full opacity-0',
      )}
    >
      {children}
    </div>
  );
};
