import type { ReactNode } from 'react';

type Props = {
  readonly children: ReactNode;
};

export const MessageActionBar = ({ children }: Props) => (
  <div data-slot="message-actions" className="col-start-2 flex items-center gap-0.5">
    {children}
  </div>
);
