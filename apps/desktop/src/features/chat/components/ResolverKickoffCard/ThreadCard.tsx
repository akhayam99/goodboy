import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Markdown, MetaRow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ResolverKickoffThread } from '../../utils/parse-resolver-kickoff';
import { openUrl } from '../../../../shared/lib/editor';
import { ConversationThread } from '../../../github/components/GitHubStudio/ConversationThread';
import { TranscriptChevron } from '../TranscriptChevron';
import { useKickoffDockedThread } from './useKickoffDockedThread';

type Props = {
  readonly thread: ResolverKickoffThread;
  readonly sessionId: SessionId | null;
};

type TitleOfParams = {
  readonly thread: ResolverKickoffThread;
};

const titleOf = ({ thread }: TitleOfParams): string => {
  const location = thread.location?.trim() ?? '';
  if (location !== '') {
    return location;
  }
  return 'PR conversation';
};

export const ThreadCard = ({ thread, sessionId }: Props) => {
  const [open, setOpen] = useState(false);
  const docked = useKickoffDockedThread({ sessionId, threadId: thread.threadId });
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
        {docked !== null ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Collapse thread' : 'Expand thread'}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            {open ? 'Hide thread' : 'View thread'}
            <TranscriptChevron open={open} />
          </button>
        ) : (
          link !== '' && (
            <button
              type="button"
              onClick={() => void openUrl(link)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              Open on GitHub
              <ArrowUpRight size={10} aria-hidden className="opacity-70" />
            </button>
          )
        )}
      </div>
      <MetaRow
        items={[author === '' ? null : who, `thread ${thread.position} of ${thread.total}`]}
      />
      {open && docked !== null ? (
        <ConversationThread thread={docked} onOpenUrl={(url) => void openUrl(url)} />
      ) : (
        <Markdown
          text={thread.body}
          className="line-clamp-3 gap-1 text-xs leading-relaxed text-muted-foreground"
        />
      )}
    </div>
  );
};
