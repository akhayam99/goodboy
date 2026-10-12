import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const DrawerBox = ({ label, action, children }: Props) => (
  <section className="flex min-w-0 flex-col gap-2">
    <SectionHeader headingLevel={3} label={label} action={action} />
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border-soft bg-subtle p-3">
      {children}
    </div>
  </section>
);
