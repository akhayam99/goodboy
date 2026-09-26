import type { ReactNode } from 'react';
import { BandRow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly summary: string;
  readonly children: ReactNode;
};

export const DefaultRow = ({ label, summary, children }: Props) => (
  <BandRow isInteractive className="min-w-0 gap-3 py-0.5">
    <span className="w-36 shrink-0 truncate text-body text-foreground">{label}</span>
    <span className="min-w-0 flex-1 truncate text-label text-faint-foreground" title={summary}>
      {summary}
    </span>
    <div className="w-[220px] min-w-0 shrink-0">{children}</div>
  </BandRow>
);
