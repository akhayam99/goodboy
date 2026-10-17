import { useMemo, type ReactNode, type Ref } from 'react';
import { ResizeHandle, cn, useFoldPhase, useResizableWidth } from '@goodboy/ui';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';

const RAIL_WIDTH_VAR = '--goodboy-diff-file-rail-width';
const RAIL_DEFAULT_PX = 320;
const RAIL_MIN_PX = 260;
const RAIL_MAX_PX = 560;
const HELD_BODY_WIDTH = `calc(var(${RAIL_WIDTH_VAR}) - 0.375rem)`;

type Props = {
  readonly isShown: boolean;
  readonly isOverlay: boolean;
  readonly frame: HTMLElement | null;
  readonly bodyRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
};

export const FileRail = ({ isShown, isOverlay, frame, bodyRef, children }: Props) => {
  const resizable = useResizableWidth<HTMLElement>({
    storageKey: STORAGE_KEYS.diffFileRailWidth,
    defaultWidth: RAIL_DEFAULT_PX,
    min: RAIL_MIN_PX,
    max: RAIL_MAX_PX,
    cssVar: RAIL_WIDTH_VAR,
  });
  const frameRef = useMemo(() => ({ current: frame }), [frame]);
  const phase = useFoldPhase({ isFolded: !isShown, frameRef });
  const isFolded = phase === 'folded';
  const isFolding = phase === 'folding';
  return (
    <aside
      ref={resizable.targetRef}
      aria-label={isFolded ? undefined : 'Files'}
      aria-hidden={isFolded || isFolding ? true : undefined}
      inert={isFolded || isFolding}
      data-file-rail={isFolded ? undefined : isOverlay ? 'overlay' : 'docked'}
      data-fold={phase}
      style={{ ...resizable.style, width: isShown ? `var(${RAIL_WIDTH_VAR})` : 0 }}
      className={cn(
        'flex min-h-0 shrink-0 overflow-clip bg-background',
        'motion-safe:transition-[width] motion-safe:duration-220 motion-safe:ease-out',
        isOverlay
          ? 'absolute inset-y-0 right-0 z-20 max-w-[calc(100%-16px)] rounded-l-frame bg-drawer'
          : 'relative h-full',
        isOverlay && !isFolded && 'shadow-xl',
      )}
    >
      {isFolded ? null : (
        <>
          <ResizeHandle {...resizable.handleProps} side="right" ariaLabel="Resize the file list" />
          <div
            ref={bodyRef}
            style={phase === 'open' ? undefined : { width: HELD_BODY_WIDTH }}
            className={cn(
              'flex min-h-0 flex-col pt-3',
              phase === 'open' ? 'min-w-0 flex-1' : 'shrink-0',
              isFolding && 'pointer-events-none motion-safe:animate-fold-label-out',
              phase === 'unfolding' && 'motion-safe:animate-fold-label-in',
            )}
          >
            {children}
          </div>
        </>
      )}
    </aside>
  );
};
