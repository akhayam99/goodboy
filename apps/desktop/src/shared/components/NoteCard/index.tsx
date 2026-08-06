import type { ReactNode } from 'react';
import { Markdown } from '@goodboy/ui';

type Props = {
  readonly header: ReactNode;
  readonly body: string;
  readonly footer?: ReactNode;
};

export const NoteCard = ({ header, body, footer }: Props) => (
  <div className="group flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
    {header}
    <Markdown text={body} className="text-sm leading-relaxed" />
    {footer}
  </div>
);
