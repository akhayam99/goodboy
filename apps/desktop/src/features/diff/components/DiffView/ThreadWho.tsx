import { ICON_SIZE } from '@goodboy/ui';

import { Person } from '../../../../shared/components/Person';
import { isBot } from '../../../integrations/github/comment-threads';
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
        <Person
          login={thread.author}
          avatarUrl={thread.authorAvatarUrl ?? null}
          size="md"
          isBot={isBot(thread.author)}
        />
      </>
    );
  }
  return <Person login={thread.author} avatarUrl={null} size="md" isBot={thread.isAgent} />;
};
