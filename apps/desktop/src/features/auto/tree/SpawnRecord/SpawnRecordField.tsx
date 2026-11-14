import type { ReactNode } from 'react';

type Props = {
  readonly name: string;
  readonly children: ReactNode;
};

export const SpawnRecordField = ({ name, children }: Props) => (
  <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-ui">
    <dt className="text-muted-foreground">{name}</dt>
    <dd className="flex min-w-0 flex-col gap-1 text-foreground">{children}</dd>
  </div>
);
