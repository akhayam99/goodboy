import { History } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { AskThread, ChatId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../../shared/utils/pluralize';

type Props = {
  readonly threads: ReadonlyArray<AskThread>;
  readonly onShow: (threadId: ChatId) => void;
};

export const AskEarlier = ({ threads, onShow }: Props) => {
  if (threads.length === 0) {
    return null;
  }
  return (
    <section aria-label="Earlier" data-testid="ask-earlier" className="flex flex-col gap-1">
      <Eyebrow label="Earlier" />
      {threads.map((thread) => (
        <button
          key={thread.id}
          type="button"
          onClick={() => onShow(thread.id)}
          className="flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-label text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <History size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">{thread.title}</span>
          <span className="shrink-0 text-meta text-faint-foreground">
            {pluralize(Math.max(thread.messageCount, 1), 'question')}
          </span>
        </button>
      ))}
    </section>
  );
};
