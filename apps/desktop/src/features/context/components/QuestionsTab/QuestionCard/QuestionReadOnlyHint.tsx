import type { ReactNode } from 'react';

type Props = {
  readonly id: string;
  readonly hint: string;
  readonly action: ReactNode;
};

export const QuestionReadOnlyHint = ({ id, hint, action }: Props) => (
  <div data-run-questions-hint="" className="flex min-w-0 items-center gap-2 text-ui">
    <span id={id} className="min-w-0 text-muted-foreground">
      {hint}
    </span>
    {action}
  </div>
);
