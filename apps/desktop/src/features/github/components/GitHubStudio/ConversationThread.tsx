import type { CommentThread } from '../../comment-threads';
import type { ResolverLink } from '../../../session/resolver-linkage';
import { OpenThread } from './OpenThread';
import { ResolvedThread } from './ResolvedThread';

type Props = {
  readonly thread: CommentThread;
  readonly link?: ResolverLink;
  readonly onOpenUrl: (url: string) => void;
};

export const ConversationThread = ({ thread, link, onOpenUrl }: Props) => {
  const { head } = thread;
  const resolved = head.source === 'review' && head.resolved === true;

  if (resolved) {
    return <ResolvedThread thread={thread} onOpenUrl={onOpenUrl} />;
  }
  return <OpenThread thread={thread} link={link} onOpenUrl={onOpenUrl} />;
};
