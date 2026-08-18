import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const ResolverPanelSection = ({ label, children }: Props) => (
  <section className="flex flex-col gap-2">
    <SectionHeader label={label} />
    {children}
  </section>
);
