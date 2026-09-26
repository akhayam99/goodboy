import type { ReactNode } from 'react';
import { PANE_RHYTHM, ScrollFade, cn } from '@goodboy/ui';

type Props = {
  readonly ariaLabel: string;
  readonly children: ReactNode;
};

export const FacetRail = ({ ariaLabel, children }: Props) => (
  <nav aria-label={ariaLabel} className="flex min-h-0 flex-1 flex-col">
    <ScrollFade
      className="min-h-0 flex-1"
      viewportClassName={cn('flex flex-col gap-4', PANE_RHYTHM.navRail.body)}
    >
      {children}
    </ScrollFade>
  </nav>
);
