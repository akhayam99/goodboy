import type { ReactNode } from 'react';
import { Markdown } from '@goodboy/ui';

type Props = {
  readonly header: ReactNode;
  readonly body: string;
};

export const NoteCard = ({ header, body }: Props) => (
  <div className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
    {header}
    <Markdown text={body} className="text-sm leading-relaxed" />
  </div>
);
