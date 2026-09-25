import type { ReactNode } from 'react';

type Props = {
  readonly note: string | null;
  readonly children: ReactNode;
};

export const StartFooter = ({ note, children }: Props) => (
  <div className="flex items-center justify-end gap-2 pt-1">
    {note == null ? null : (
      <span className="min-w-0 flex-1 text-2xs text-faint-foreground">{note}</span>
    )}
    {children}
  </div>
);
