import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly action?: ReactNode;
  readonly labelAction?: ReactNode;
  readonly children: ReactNode;
};

export const PropertyField = ({ label, action, labelAction, children }: Props) => (
  <section
    aria-label={label}
    className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] items-start gap-x-3"
  >
    <span className="flex min-h-7 min-w-0 items-center gap-1 text-label text-muted-foreground">
      <span className="min-w-0 truncate">{label}</span>
      {labelAction === undefined || labelAction === null ? null : labelAction}
    </span>
    <div className="flex min-w-0 items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {action === undefined || action === null ? null : (
        <div className="flex min-h-7 shrink-0 items-center">{action}</div>
      )}
    </div>
  </section>
);
