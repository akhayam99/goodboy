import { useRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { useFoldPhase } from '../useFoldPhase';
import { COLLAPSED_RAIL_WIDTH } from './AppShell';

export type FoldLayersProps = {
  readonly isFolded: boolean;
  readonly open: ReactNode;
  readonly folded: ReactNode;
  readonly openWidth: string;
  readonly className?: string;
};

const LAYER = 'absolute inset-y-0 left-0 flex min-h-0 flex-col';

export const FoldLayers = ({ isFolded, open, folded, openWidth, className }: FoldLayersProps) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const phase = useFoldPhase({ isFolded, frameRef });
  const isFolding = phase === 'folding';
  const isUnfolding = phase === 'unfolding';
  return (
    <div
      ref={frameRef}
      data-fold={phase}
      className={cn('relative min-h-0 min-w-0 flex-1 overflow-clip bg-inherit', className)}
    >
      {phase === 'open' ? null : (
        <div
          data-fold-layer="folded"
          aria-hidden={isUnfolding ? true : undefined}
          inert={isUnfolding}
          className={LAYER}
          style={{ width: COLLAPSED_RAIL_WIDTH }}
        >
          {folded}
        </div>
      )}
      {phase === 'folded' ? null : (
        <div
          data-fold-layer="open"
          aria-hidden={isFolding ? true : undefined}
          inert={isFolding}
          className={cn(
            LAYER,
            phase !== 'open' && 'bg-inherit',
            isFolding && 'pointer-events-none motion-safe:animate-fold-label-out',
            isUnfolding && 'motion-safe:animate-fold-label-in',
          )}
          style={{ width: openWidth }}
        >
          {open}
        </div>
      )}
    </div>
  );
};
