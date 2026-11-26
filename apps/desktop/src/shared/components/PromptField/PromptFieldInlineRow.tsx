import type { ReactNode } from 'react';

type Props = {
  readonly actions: ReactNode;
  readonly children: ReactNode;
};

export const PromptFieldInlineRow = ({ actions, children }: Props) => (
  <div className="flex items-center gap-2 pr-2">
    <div className="min-w-0 flex-1">{children}</div>
    <div className="flex shrink-0 items-center">{actions}</div>
  </div>
);
