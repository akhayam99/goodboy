import type { ReactNode, RefObject } from 'react';
import { cn } from '@goodboy/ui';
import { TREE_OVERLAY_WIDTH } from '../../hooks/useTreeWidth';
import { TREE_STRIP_WIDTH } from '../../treeRailMode';
import { TreeRailHead } from './TreeRailHead';

type Props = {
  readonly variant: 'docked' | 'overlay';
  readonly asideRef: RefObject<HTMLElement | null>;
  readonly width: number;
  readonly count: number | null;
  readonly isAfterStrip: boolean;
  readonly onFold: (() => void) | null;
  readonly resizer?: ReactNode;
  readonly children: ReactNode;
};

export const TreeRail = ({
  variant,
  asideRef,
  width,
  count,
  isAfterStrip,
  onFold,
  resizer = null,
  children,
}: Props) => {
  const isOverlay = variant === 'overlay';
  return (
    <aside
      ref={asideRef}
      aria-label="Files"
      data-rail={variant}
      style={
        isOverlay
          ? { width: TREE_OVERLAY_WIDTH, left: isAfterStrip ? TREE_STRIP_WIDTH : 0 }
          : { width }
      }
      className={cn(
        'flex min-h-0 flex-col border-r border-border-soft bg-background',
        isOverlay ? 'absolute inset-y-0 shadow-lg' : 'relative h-full shrink-0',
      )}
    >
      <TreeRailHead count={count} isOverlay={isOverlay} onFold={onFold} />
      <div className="flex min-h-0 flex-1">{children}</div>
      {resizer}
    </aside>
  );
};
