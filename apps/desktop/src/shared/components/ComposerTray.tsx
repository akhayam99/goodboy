import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const ComposerTray = ({ children }: Props) => (
  <div className="flex flex-col gap-2 rounded-t-lg bg-muted px-2 pb-2 pt-2">{children}</div>
);
