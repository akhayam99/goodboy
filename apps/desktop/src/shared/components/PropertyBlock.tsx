import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export const PropertyBlock = ({ label, action, children }: Props) => (
  <section aria-label={label} className="flex min-w-0 flex-col gap-1">
    <div className="flex min-h-6 min-w-0 items-center justify-between gap-2">
      <span className="min-w-0 truncate text-meta text-faint-foreground">{label}</span>
      {action ?? null}
    </div>
    {children}
  </section>
);
