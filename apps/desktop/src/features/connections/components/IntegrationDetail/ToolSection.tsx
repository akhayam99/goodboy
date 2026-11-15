import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly id?: string;
  readonly label: string;
  readonly meta?: string;
  readonly children: ReactNode;
};

export const ToolSection = ({ id, label, meta, children }: Props) => (
  <section id={id} aria-label={label} className="flex min-w-0 scroll-mt-4 flex-col gap-2">
    <SectionHeader
      label={label}
      headingLevel={2}
      meta={
        meta === undefined ? undefined : (
          <span className="text-meta text-faint-foreground">{meta}</span>
        )
      }
    />
    {children}
  </section>
);
