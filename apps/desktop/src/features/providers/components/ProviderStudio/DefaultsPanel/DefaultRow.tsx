import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly summary: string;
  readonly children: ReactNode;
};

export const DefaultRow = ({ label, summary, children }: Props) => (
  <div className="flex min-h-9 min-w-0 items-center gap-3 py-0.5">
    <span className="w-36 shrink-0 truncate text-sm text-foreground">{label}</span>
    <span className="min-w-0 flex-1 truncate text-xs text-faint-foreground" title={summary}>
      {summary}
    </span>
    <div className="w-[220px] min-w-0 shrink-0">{children}</div>
  </div>
);
