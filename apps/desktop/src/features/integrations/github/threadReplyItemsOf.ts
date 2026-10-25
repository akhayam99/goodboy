import type { PrComment } from '@goodboy/types';
import type { ThreadReplyItem } from '../../../shared/components/ThreadReplies/threadReplyItem';
import { isBot } from './comment-threads';

type Params = {
  readonly replies: ReadonlyArray<PrComment>;
};

export const threadReplyItemsOf = ({ replies }: Params): ReadonlyArray<ThreadReplyItem> =>
  replies.map((reply) => ({
    id: reply.id,
    author: reply.author,
    body: reply.body,
    createdAt: reply.createdAt,
    avatarUrl: reply.authorAvatarUrl,
    isBot: isBot(reply.author),
  }));
