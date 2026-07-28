import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const AxisRow = ({ label, children }: Props) => (
  <div className="flex items-center gap-2">
    <span className="w-14 shrink-0 text-2xs font-medium text-muted-foreground">{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);
