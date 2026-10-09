import type { ReactNode } from 'react';

type RowProps = {
  readonly name: string;
  readonly children: ReactNode;
};

export const SceneRow = ({ name, children }: RowProps) => (
  <div data-scene-row={name} className="flex min-w-0 flex-col gap-2">
    <span className="text-meta text-faint-foreground">{name}</span>
    <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
  </div>
);
