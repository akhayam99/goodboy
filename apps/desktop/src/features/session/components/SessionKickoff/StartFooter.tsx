import type { ReactNode } from 'react';

type Props = {
  readonly note: string | null;
  readonly error?: string | null;
  readonly children: ReactNode;
};

export const StartFooter = ({ note, error = null, children }: Props) => (
  <div className="flex flex-col gap-1 pt-1">
    {error == null ? null : (
      <p role="alert" className="text-secondary text-danger">
        {error}
      </p>
    )}
    <div className="flex items-center justify-end gap-2">
      {note == null ? null : (
        <span className="min-w-0 flex-1 text-secondary text-faint-foreground">{note}</span>
      )}
      {children}
    </div>
  </div>
);
