import { ArrowUpRight } from 'lucide-react';
import { Markdown, MetaRow } from '@goodboy/ui';
import type { ResolverKickoffThread } from '../../utils/parse-resolver-kickoff';
import { openUrl } from '../../../../shared/lib/editor';

type Props = {
  readonly thread: ResolverKickoffThread;
};

const titleOf = ({ thread }: Props): string => {
  const location = thread.location?.trim() ?? '';
  if (location !== '') {
    return location;
  }
  return 'PR conversation';
};

export const ThreadCard = ({ thread }: Props) => {
  const link = thread.link?.trim() ?? '';
  const author = thread.author?.trim() ?? '';
  const replyCount = thread.replies.length;
  const who = replyCount === 0 ? author : `${author} and ${replyCount} more`;

  return (
    <div
      data-testid="resolver-kickoff-thread"
      className="flex min-w-0 flex-col gap-1.5 rounded-md bg-muted/20 p-3"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
          {titleOf({ thread })}
        </span>
        {link !== '' && (
          <button
            type="button"
            onClick={() => void openUrl(link)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            Open thread
            <ArrowUpRight size={10} aria-hidden className="opacity-70" />
          </button>
        )}
      </div>
      <MetaRow
        items={[author === '' ? null : who, `thread ${thread.position} of ${thread.total}`]}
      />
      <Markdown
        text={thread.body}
        className="line-clamp-3 gap-1 text-xs leading-relaxed text-muted-foreground"
      />
    </div>
  );
};
