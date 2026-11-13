import { useState, type ReactNode } from 'react';
import { PinnedInsetContext } from '../useHeaderReveal/pinnedInsetContext';
import { RevealRegion } from './RevealRegion';

type Props = {
  readonly header: ReactNode;
  readonly stepAside: ReactNode;
  readonly children: ReactNode;
};

export const DrawerRegion = ({ header, stepAside, children }: Props) => {
  const [fill, setFill] = useState<HTMLDivElement | null>(null);

  return (
    <PinnedInsetContext.Provider value={null}>
      <RevealRegion
        surface="subtle"
        pinned={
          <div data-slot="reveal-pinned" className="sticky-surface-subtle">
            {header}
          </div>
        }
        header={stepAside}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-[var(--reveal-inset,0px)]">
          <div ref={setFill} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PinnedInsetContext.Provider value={fill}>{children}</PinnedInsetContext.Provider>
          </div>
        </div>
      </RevealRegion>
    </PinnedInsetContext.Provider>
  );
};
