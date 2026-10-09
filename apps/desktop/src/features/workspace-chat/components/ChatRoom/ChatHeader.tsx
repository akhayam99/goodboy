import type { ReactNode } from 'react';
import { PageColumn } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly sessions?: ReactNode;
  readonly action?: ReactNode;
};

export const ChatHeader = ({ title, sessions = null, action = null }: Props) => (
  <header className="shrink-0 pb-3">
    <PageColumn className="flex h-8 min-w-0 items-center gap-2">
      <h1 className="min-w-0 truncate text-title text-foreground">{title}</h1>
      {sessions}
      <span className="flex-1" />
      {action}
    </PageColumn>
  </header>
);
