import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const Eyebrow = ({ children }: Props) => (
  <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
    {children}
  </span>
);
