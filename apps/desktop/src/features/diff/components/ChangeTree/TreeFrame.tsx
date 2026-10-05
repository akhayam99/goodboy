import type { ReactNode } from 'react';
import { KEY_HELP } from './keyHelp';

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
    <p className="shrink-0 px-3 py-2 text-meta text-faint-foreground">{KEY_HELP}</p>
  </nav>
);
