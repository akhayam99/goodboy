import type { ReactNode } from 'react';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly action?: ReactNode;
};

export const LevelLabel = ({ id, label, action }: Props) => (
  <div
    data-level-label={label}
    className="flex h-7 min-w-0 items-center justify-between gap-2 px-2"
  >
    <h2 id={id} className="truncate text-ui text-muted-foreground">
      {label}
    </h2>
    {action === undefined ? null : <div className="flex shrink-0 items-center">{action}</div>}
  </div>
);
