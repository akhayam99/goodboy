import type { ReactNode } from 'react';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly children: ReactNode;
};

export const HandoffCardShell = ({ children }: Props) => (
  <TranscriptShell
    data-testid="handoff-card"
    tone="neutral"
    variant="leftBorder"
    className="flex w-full max-w-xl flex-col gap-2 text-meta"
  >
    {children}
  </TranscriptShell>
);
