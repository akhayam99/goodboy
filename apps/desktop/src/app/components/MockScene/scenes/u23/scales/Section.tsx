import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type SectionProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export const Section = ({ title, children }: SectionProps) => (
  <section data-scene-row={title} className="flex min-w-0 flex-col gap-3">
    <Eyebrow label={title} />
    {children}
  </section>
);
