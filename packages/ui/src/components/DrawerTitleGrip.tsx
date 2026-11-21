import { useContext, type ReactNode } from 'react';
import { cn } from '../cn';
import { DockDragContext } from '../dockDragContext';

type Props = {
  readonly isTop: boolean;
  readonly children: ReactNode;
};

const CONTROL = 'button, a, input, select, textarea, [role="button"], [role="combobox"]';

export const DrawerTitleGrip = ({ isTop, children }: Props) => {
  const source = useContext(DockDragContext);
  return (
    <div
      data-dock-drag-source={source === null ? undefined : ''}
      onPointerDown={
        source === null
          ? undefined
          : (event) => {
              if (event.target instanceof Element && event.target.closest(CONTROL) !== null) {
                return;
              }
              source.onStart({ event });
            }
      }
      className={cn(
        'flex min-w-0 flex-1 gap-2',
        isTop ? 'items-start' : 'items-center',
        source !== null && 'cursor-grab',
      )}
    >
      {children}
    </div>
  );
};
