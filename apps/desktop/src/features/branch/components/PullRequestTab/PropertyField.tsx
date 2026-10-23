import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly action?: ReactNode;
  readonly labelAction?: ReactNode;
  readonly children: ReactNode;
};

export const PropertyField = ({ label, action, labelAction, children }: Props) => (
  <section aria-label={label} className="flex min-w-0 flex-col gap-1">
    <span className="flex min-h-6 min-w-0 items-center justify-between gap-2 text-meta text-muted-foreground">
      <span className="min-w-0 truncate">{label}</span>
      {labelAction === undefined || labelAction === null ? null : labelAction}
      {action === undefined || action === null ? null : action}
    </span>
    <div className="flex min-w-0 flex-col">{children}</div>
  </section>
);
