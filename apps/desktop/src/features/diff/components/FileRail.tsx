import type { ReactNode, Ref } from 'react';
import { ResizeHandle, cn, useResizableWidth } from '@goodboy/ui';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

const RAIL_WIDTH_VAR = '--goodboy-diff-file-rail-width';
const RAIL_DEFAULT_PX = 320;
const RAIL_MIN_PX = 260;
const RAIL_MAX_PX = 560;

type Props = {
  readonly isOverlay: boolean;
  readonly bodyRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
};

export const FileRail = ({ isOverlay, bodyRef, children }: Props) => {
  const resizable = useResizableWidth<HTMLElement>({
    storageKey: STORAGE_KEYS.diffFileRailWidth,
    defaultWidth: RAIL_DEFAULT_PX,
    min: RAIL_MIN_PX,
    max: RAIL_MAX_PX,
    cssVar: RAIL_WIDTH_VAR,
  });
  return (
    <aside
      ref={resizable.targetRef}
      aria-label="Files"
      data-file-rail={isOverlay ? 'overlay' : 'docked'}
      style={{ ...resizable.style, width: `var(${RAIL_WIDTH_VAR})` }}
      className={cn(
        'flex min-h-0 shrink-0 bg-background',
        isOverlay
          ? 'absolute inset-y-0 right-0 z-20 max-w-[calc(100%-16px)] rounded-l-frame bg-drawer shadow-xl'
          : 'relative h-full',
      )}
    >
      <ResizeHandle {...resizable.handleProps} side="right" ariaLabel="Resize the file list" />
      <div ref={bodyRef} className="flex min-h-0 min-w-0 flex-1 flex-col pt-3">
        {children}
      </div>
    </aside>
  );
};
