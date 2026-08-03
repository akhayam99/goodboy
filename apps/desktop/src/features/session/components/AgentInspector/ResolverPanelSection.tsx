import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const ResolverPanelSection = ({ label, children }: Props) => (
  <section className="flex flex-col gap-2">
    <Eyebrow label={label} muted />
    {children}
  </section>
);
