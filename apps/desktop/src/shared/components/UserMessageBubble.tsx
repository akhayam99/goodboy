import type { ReactNode } from 'react';
import { Markdown, PANE_RHYTHM } from '@goodboy/ui';

type Props = {
  readonly text: string;
  readonly children?: ReactNode;
  readonly isOnDrawer?: boolean;
};

export const UserMessageBubble = ({ text, children, isOnDrawer = false }: Props) => (
  <div
    data-chat-message="user"
    data-surface={isOnDrawer ? 'drawer' : 'page'}
    className={`flex min-w-0 ${PANE_RHYTHM.message.user} flex-col gap-2 self-end wrap-anywhere rounded-lg ${isOnDrawer ? 'bg-selected' : 'bg-subtle'} px-3 py-2 text-prose text-foreground`}
  >
    {text === '' ? null : <Markdown text={text} />}
    {children}
  </div>
);
