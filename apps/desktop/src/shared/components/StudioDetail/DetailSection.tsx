import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const DetailSection = ({ label, icon, action, children }: Props) => {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader label={label} icon={icon} action={action} />
      <div className="rounded-lg border border-border-soft bg-muted/10 p-4">{children}</div>
    </section>
  );
};
