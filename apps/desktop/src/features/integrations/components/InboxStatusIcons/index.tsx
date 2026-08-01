import type { ReactNode } from 'react';

type Props = {
  readonly sessionIcon?: ReactNode;
  readonly codeHostIcon?: ReactNode;
};

export const InboxStatusIcons = ({ sessionIcon = null, codeHostIcon = null }: Props) => (
  <span className="flex shrink-0 items-center gap-1">
    <span className="flex size-3 shrink-0 items-center justify-center">{sessionIcon}</span>
    <span className="flex size-3 shrink-0 items-center justify-center">{codeHostIcon}</span>
  </span>
);
