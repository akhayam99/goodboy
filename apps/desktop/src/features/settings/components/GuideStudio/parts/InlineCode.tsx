import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const InlineCode = ({ children }: Props) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
    {children}
  </code>
);
