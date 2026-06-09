import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import { SectionHeader } from './SectionHeader';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
};

export const Widget = ({ label, hint, action, className, children }: Props) => {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border-soft bg-muted/10 p-4',
        className,
      )}
    >
      <SectionHeader label={label} hint={hint} action={action} />
      {children}
    </section>
  );
};
