import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const MetaItem = ({ label, children }: Props) => {
  return (
    <dl className="flex flex-col gap-1">
      <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center gap-1.5 text-xs text-foreground">{children}</dd>
    </dl>
  );
};
