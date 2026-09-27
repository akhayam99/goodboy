import type { ReactNode } from 'react';

type Props = {
  readonly note: string | null;
  readonly error?: string | null;
  readonly children: ReactNode;
};

export const SetupStepActions = ({ note, error = null, children }: Props) => (
  <div className="flex min-w-0 items-center gap-2">
    {error !== null ? (
      <span role="alert" className="min-w-0 flex-1 text-secondary text-danger">
        {error}
      </span>
    ) : (
      <span className="min-w-0 flex-1 text-secondary text-faint-foreground">{note ?? ''}</span>
    )}
    <div className="flex shrink-0 items-center gap-2">{children}</div>
  </div>
);
