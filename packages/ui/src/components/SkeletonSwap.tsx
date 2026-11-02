import type { ReactNode } from 'react';
import { cn } from '../cn';
import { useSkeletonGate } from '../useSkeletonGate';

type Props = {
  readonly gateKey: string;
  readonly isLoaded: boolean;
  readonly skeleton: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export const SkeletonSwap = ({ gateKey, isLoaded, skeleton, children, className }: Props) => {
  const phase = useSkeletonGate({ gateKey, isLoaded });
  const isFading = phase === 'fading';
  const isContentShown = isFading || phase === 'ready';
  return (
    <div data-skeleton-phase={phase} className={cn('relative', className)}>
      {phase === 'skeleton' || isFading ? (
        <div
          aria-hidden={isFading ? true : undefined}
          inert={isFading}
          className={cn(
            isFading
              ? 'pointer-events-none absolute inset-0 z-10 overflow-hidden motion-safe:animate-layer-out'
              : 'contents',
          )}
        >
          {skeleton}
        </div>
      ) : null}
      {isContentShown ? <div className="contents">{children}</div> : null}
    </div>
  );
};
