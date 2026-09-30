import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly sessionIcon?: ReactNode;
  readonly codeHostIcon?: ReactNode;
  readonly className?: string;
};

export const InboxStatusIcons = ({ sessionIcon = null, codeHostIcon = null, className }: Props) => (
  <span className={cn('flex shrink-0 items-center gap-1', className)}>
    <span className="flex size-3 shrink-0 items-center justify-center">{sessionIcon}</span>
    <span className="flex size-3 shrink-0 items-center justify-center">{codeHostIcon}</span>
  </span>
);
