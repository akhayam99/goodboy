import type { ReactNode } from 'react';

type Props = {
  readonly text: string;
  readonly action?: ReactNode;
};

export const EmptyLine = ({ text, action }: Props) => (
  <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-2">
    <span className="text-meta text-muted-foreground">{text}</span>
    {action}
  </div>
);
