import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const MetaItem = ({ label, children }: Props) => {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground">{children}</div>
    </div>
  );
};
