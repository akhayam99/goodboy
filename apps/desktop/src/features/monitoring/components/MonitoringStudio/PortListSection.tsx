import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count: number;
  readonly children: ReactNode;
};

export const PortListSection = ({ label, count, children }: Props) => (
  <section aria-label={label} className="flex flex-col gap-2">
    <SectionHeader
      label={label}
      headingLevel={2}
      meta={<span className="text-meta tabular-nums text-faint-foreground">{count}</span>}
    />
    {children}
  </section>
);
