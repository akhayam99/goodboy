import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
  readonly variant?: 'framed' | 'frameless';
  readonly children: ReactNode;
};

export const DetailSection = ({ label, icon, action, variant = 'framed', children }: Props) => {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader label={label} icon={icon} action={action} />
      <div
        className={
          variant === 'framed' ? 'rounded-lg border border-border-soft bg-muted/10 p-4' : undefined
        }
      >
        {children}
      </div>
    </section>
  );
};
