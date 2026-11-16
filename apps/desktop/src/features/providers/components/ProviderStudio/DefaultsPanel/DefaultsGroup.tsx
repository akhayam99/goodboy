import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly children: ReactNode;
};

export const DefaultsGroup = ({ label, children }: Props) => (
  <div role="group" aria-label={label} className="flex flex-col">
    <span className="px-2 pb-1 pt-2 text-meta text-muted-foreground">{label}</span>
    {children}
  </div>
);
