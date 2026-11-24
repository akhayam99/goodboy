import type { ReactNode } from 'react';
import { cn } from '../cn';
import { useDockGrip } from '../useDockGrip';

type Props = {
  readonly isTop: boolean;
  readonly children: ReactNode;
};

export const DrawerTitleGrip = ({ isTop, children }: Props) => {
  const grip = useDockGrip();
  return (
    <div
      data-dock-drag-source={grip.canDrag ? '' : undefined}
      onPointerDown={grip.canDrag ? (event) => grip.press({ event }) : undefined}
      className={cn(
        'flex min-w-0 flex-1 gap-2',
        isTop ? 'items-start' : 'items-center',
        grip.canDrag && 'cursor-grab',
      )}
    >
      {children}
    </div>
  );
};
