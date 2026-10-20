import type { ReactNode } from 'react';

type Props = {
  readonly glyph: ReactNode;
  readonly words: ReactNode;
};

export const FactCardState = ({ glyph, words }: Props) => (
  <div className="flex items-center gap-2 text-meta text-muted-foreground">
    <span className="flex size-4 shrink-0 items-center justify-center">{glyph}</span>
    <span className="min-w-0 truncate">{words}</span>
  </div>
);
