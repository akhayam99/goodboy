import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const MetaItem = ({ label, children }: Props) => {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-foreground wrap-anywhere">
        {children}
      </dd>
    </div>
  );
};
