import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const MessageActionBar = ({ children }: Props) => (
  <div
    data-slot="message-actions"
    className="absolute -top-3 right-1.5 z-10 flex items-center gap-0.5 rounded-md border border-border-soft bg-floating p-0.5 opacity-0 shadow-md motion-safe:transition-opacity focus-within:opacity-100 group-hover/message:opacity-100"
  >
    {children}
  </div>
);
