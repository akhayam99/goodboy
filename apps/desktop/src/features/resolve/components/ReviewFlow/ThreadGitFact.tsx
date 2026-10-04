import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';

type Props = { readonly icon: ReactNode; readonly children: ReactNode; readonly tone?: string };

export const ThreadGitFact = ({ icon, children, tone = 'text-muted-foreground' }: Props) => (
  <p className="flex min-w-0 items-start gap-2 text-meta text-foreground">
    <span aria-hidden className={cn('mt-0.5 shrink-0', tone)}>
      {icon}
    </span>
    <span className="min-w-0">{children}</span>
  </p>
);
