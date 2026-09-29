import type { ReactNode } from 'react';

type Props = {
  readonly title: string;
  readonly sessions?: ReactNode;
  readonly action?: ReactNode;
};

export const ChatHeader = ({ title, sessions = null, action = null }: Props) => (
  <header className="flex min-w-0 shrink-0 items-center gap-2 px-6 pb-2.5 pt-3">
    <h2 className="min-w-0 truncate text-heading text-foreground">{title}</h2>
    {sessions}
    <span className="flex-1" />
    {action}
  </header>
);
