import type { ReactNode } from 'react';
import { SectionHeader, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export const Widget = ({ label, hint, className, children }: Props) => (
  <section
    className={cn(
      'flex flex-col gap-3 rounded-lg border border-border-soft bg-muted/10 p-4',
      className,
    )}
  >
    <SectionHeader label={label} hint={hint} />
    {children}
  </section>
);
