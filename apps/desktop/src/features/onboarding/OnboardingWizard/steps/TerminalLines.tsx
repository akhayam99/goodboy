import type { ReactNode } from 'react';

type Props = {
  readonly command: string | null;
  readonly children: ReactNode;
};

export const TerminalLines = ({ command, children }: Props) => (
  <div
    aria-live="polite"
    className="flex flex-col rounded-md border border-border-soft bg-background px-3 py-2 text-code break-words text-muted-foreground"
  >
    {command === null ? null : (
      <span>
        <span className="text-faint-foreground">$ </span>
        {command}
      </span>
    )}
    {children}
  </div>
);
