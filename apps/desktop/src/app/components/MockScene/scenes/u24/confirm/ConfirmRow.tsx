import type { ReactNode } from 'react';

type Props = {
  readonly label: string;
  readonly meta?: string;
  readonly children: ReactNode;
};

export const ConfirmRow = ({ label, meta, children }: Props) => (
  <div
    data-slot="confirm-row"
    data-confirm-row
    className="group flex h-10 min-w-0 items-center gap-3 rounded-md px-2 hover:bg-hover"
  >
    <span className="min-w-0 flex-1 truncate text-label text-foreground">{label}</span>
    {meta === undefined ? null : (
      <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{meta}</span>
    )}
    {children}
  </div>
);
