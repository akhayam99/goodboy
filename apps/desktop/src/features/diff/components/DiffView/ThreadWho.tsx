import { Bot, PenLine } from 'lucide-react';
import { Avatar, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { HOST_GLYPH } from './threadKind';
import type { DiffThread } from './types';

type Props = {
  readonly thread: DiffThread;
};

export const ThreadWho = ({ thread }: Props) => {
  if (thread.source === 'host') {
    const Glyph = HOST_GLYPH[thread.host ?? 'github'];
    return (
      <>
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
        >
          <Glyph size={ICON_SIZE.control} />
        </span>
        <Avatar url={thread.authorAvatarUrl ?? null} alt={thread.author} size="xs" />
        <span className="min-w-0 truncate text-row text-foreground">{thread.author}</span>
      </>
    );
  }
  const tint = tintClasses('primary');
  const Icon = thread.isAgent ? Bot : PenLine;
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md',
          tint.bg,
          tint.text,
        )}
      >
        <Icon size={ICON_SIZE.row} />
      </span>
      <span className="min-w-0 truncate text-row text-foreground">{thread.author}</span>
    </>
  );
};
