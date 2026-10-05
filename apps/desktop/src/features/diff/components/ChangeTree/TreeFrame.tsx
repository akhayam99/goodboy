import type { ReactNode } from 'react';
import { KeyHints } from './KeyHints';

type Props = {
  readonly heading: string;
  readonly children: ReactNode;
};

export const TreeFrame = ({ heading, children }: Props) => (
  <nav aria-label="Changed files" className="flex min-h-0 w-full min-w-0 flex-col">
    <div className="flex flex-col gap-2 px-3 pb-2">
      <p className="text-meta tabular-nums text-muted-foreground">{heading}</p>
      <span aria-hidden className="block h-0.5 rounded-full bg-border-soft" />
    </div>
    <div className="min-h-0 flex-1 px-3 pt-2">{children}</div>
    <KeyHints />
  </nav>
);
