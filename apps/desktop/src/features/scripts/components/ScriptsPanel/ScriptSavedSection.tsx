import type { ReactNode } from 'react';

type Props = {
  readonly count: number;
  readonly children: ReactNode;
};

export const ScriptSavedSection = ({ count, children }: Props) => (
  <section aria-label="Saved scripts" className="flex flex-col gap-0.5">
    <header className="flex h-6 items-center gap-2 px-2">
      <span className="truncate text-secondary text-muted-foreground">
        Saved <span className="tabular-nums text-faint-foreground">{count}</span>
      </span>
    </header>
    {children}
  </section>
);
