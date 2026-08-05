import type { ReactNode } from 'react';

type NoteHeaderSize = 'xs' | 'sm';

type Props = {
  readonly avatar?: ReactNode;
  readonly author: string;
  readonly timestamp?: ReactNode;
  readonly size?: NoteHeaderSize;
};

const ROW_CLASS: Record<NoteHeaderSize, string> = {
  xs: 'flex items-center gap-2 text-2xs text-muted-foreground',
  sm: 'flex items-center gap-1.5 text-xs text-muted-foreground',
};

export const NoteHeader = ({ avatar, author, timestamp, size = 'sm' }: Props) => (
  <div className={ROW_CLASS[size]}>
    {avatar}
    <span className="font-medium text-foreground">{author}</span>
    {timestamp}
  </div>
);
