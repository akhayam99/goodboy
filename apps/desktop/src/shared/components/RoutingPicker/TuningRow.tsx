import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const TuningRow = ({ label, children }: Props) => (
  <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
    <span className="text-2xs font-medium text-muted-foreground">{label}</span>
    {children}
  </div>
);
