import { useContext, type ReactNode } from 'react';
import { cn } from '../cn';
import { DockTabsContext } from '../dockTabsContext';
import { useDockGrip } from '../useDockGrip';

type Props = {
  readonly isTop: boolean;
  readonly children: ReactNode;
};

export const DrawerTitleGrip = ({ isTop, children }: Props) => {
  const grip = useDockGrip();
  const isTabbed = useContext(DockTabsContext) !== null;
  const canDrag = grip.canDrag && !isTabbed;
  return (
    <div
      data-dock-drag-source={canDrag ? '' : undefined}
      onPointerDown={canDrag ? (event) => grip.press({ event }) : undefined}
      className={cn(
        'flex min-w-0 flex-1 gap-2',
        isTop ? 'items-start' : 'items-center',
        canDrag && 'cursor-grab',
      )}
    >
      {children}
    </div>
  );
};
