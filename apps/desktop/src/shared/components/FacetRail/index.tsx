import type { ReactNode } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';

type Props = {
  readonly ariaLabel: string;
  readonly children: ReactNode;
};

export const FacetRail = ({ ariaLabel, children }: Props) => (
  <nav
    aria-label={ariaLabel}
    className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto', PANE_RHYTHM.navRail.body)}
  >
    {children}
  </nav>
);
