import type { ReactNode } from 'react';
import { PageColumn } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly sessions?: ReactNode;
  readonly action?: ReactNode;
};

export const ChatHeader = ({ title, sessions = null, action = null }: Props) => (
  <header className="shrink-0 pb-2.5 pt-3">
    <PageColumn className="flex min-w-0 items-center gap-2">
      <h2 className="min-w-0 truncate text-heading text-foreground">{title}</h2>
      {sessions}
      <span className="flex-1" />
      {action}
    </PageColumn>
  </header>
);
