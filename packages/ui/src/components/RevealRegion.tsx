import { useRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { useHeaderReveal } from '../useHeaderReveal';
import { ClaimedScrollerContext } from '../useHeaderReveal/claimedScrollerContext';
import { HeaderRevealContext } from '../useHeaderReveal/headerRevealContext';

type Props = {
  readonly header: ReactNode;
  readonly resetKey?: string | null;
  readonly surface?: 'background' | 'subtle';
  readonly hasLanes?: boolean;
  readonly children: ReactNode;
};

const SURFACE_CLASS = {
  background: 'sticky-surface',
  subtle: 'sticky-surface-subtle',
} as const satisfies Record<NonNullable<Props['surface']>, string>;

export const RevealRegion = ({
  header,
  resetKey = null,
  surface = 'background',
  hasLanes = false,
  children,
}: Props) => {
  const regionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reveal = useHeaderReveal({ regionRef, headerRef, bodyRef, resetKey, hasLanes });

  return (
    <div
      ref={regionRef}
      data-slot="reveal-region"
      className="group/reveal relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip"
    >
      <HeaderRevealContext.Provider value={null}>
        <div
          ref={headerRef}
          data-slot="reveal-header"
          className={cn(
            'absolute inset-x-0 top-[calc(var(--reveal-shift,0px)*-1)] z-20',
            SURFACE_CLASS[surface],
            'motion-safe:transition-[top] motion-safe:duration-(--reveal-duration) motion-safe:ease-(--reveal-ease)',
          )}
        >
          {header}
        </div>
      </HeaderRevealContext.Provider>
      <HeaderRevealContext.Provider value={reveal}>
        <ClaimedScrollerContext.Provider value={false}>
          <div
            ref={bodyRef}
            data-slot="reveal-body"
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col pt-[var(--reveal-pad,0px)]',
              'group-data-[reveal=slide]/reveal:h-[calc(100%+var(--reveal-shift,0px))] group-data-[reveal=slide]/reveal:flex-none',
              'relative group-data-[reveal=slide]/reveal:top-[calc(var(--reveal-shift,0px)*-1)]',
              'motion-safe:duration-(--reveal-duration) motion-safe:ease-(--reveal-ease) group-data-[reveal=slide]/reveal:motion-safe:transition-[top,height]',
            )}
          >
            {children}
          </div>
        </ClaimedScrollerContext.Provider>
      </HeaderRevealContext.Provider>
    </div>
  );
};
