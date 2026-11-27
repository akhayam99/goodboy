import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const ConnectSection = ({ label, action, children }: Props) => (
  <section aria-label={label} className="flex min-w-0 flex-col gap-2">
    <SectionHeader label={label} headingLevel={2} action={action} />
    {children}
  </section>
);
