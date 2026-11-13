import { isBotLogin } from '@goodboy/core/review-source';
import type { ActivityItem } from '../../shared/components/PullRequestActivity/activityItem';
import type {
  ConversationMessage,
  ConversationThread,
} from '../../shared/components/Conversation/types';
import { groupBotActivity } from './components/PullRequestTab/groupBotActivity';

type PersonParams = {
  readonly who: string | null;
  readonly avatarUrl: string | null;
};

type EndParams = PersonParams & {
  readonly kind: 'merged' | 'closed';
  readonly at: string;
};

type OpenedParams = PersonParams & {
  readonly at: string | null;
  readonly isDraft: boolean;
};

type Params = {
  readonly opened: OpenedParams;
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly end: EndParams | null;
};

type MessageParams = {
  readonly message: ConversationMessage;
};

const messageItemOf = ({ message }: MessageParams): ActivityItem | null => {
  const who = message.author.handle ?? message.author.name;
  if (who === '' || message.createdAt === '') {
    return null;
  }
  const isBot = isBotLogin({ login: who });
  return {
    kind: 'review',
    key: `message:${message.id}`,
    at: message.createdAt,
    who,
    avatarUrl: message.author.avatarUrl,
    verdict: 'commented',
    text: isBot ? message.body.trim() : '',
    isBot,
  };
};

const messagesOf = ({ threads }: Pick<Params, 'threads'>): ReadonlyArray<ActivityItem> =>
  threads.flatMap((thread) =>
    [thread.head, ...thread.replies].flatMap((message) => messageItemOf({ message }) ?? []),
  );

const endItemOf = ({ end }: Pick<Params, 'end'>): ReadonlyArray<ActivityItem> => {
  if (end === null) {
    return [];
  }
  if (end.kind === 'closed') {
    return [{ kind: 'closed', key: 'closed', at: end.at }];
  }
  return [{ kind: 'merged', key: 'merged', at: end.at, who: end.who, avatarUrl: end.avatarUrl }];
};

export const hostActivityOf = ({ opened, threads, end }: Params): ReadonlyArray<ActivityItem> => {
  const items: ReadonlyArray<ActivityItem> = [
    ...(opened.at === null
      ? []
      : [
          {
            kind: 'opened' as const,
            key: 'opened',
            at: opened.at,
            who: opened.who,
            avatarUrl: opened.avatarUrl,
            isDraft: opened.isDraft,
          },
        ]),
    ...messagesOf({ threads }),
    ...endItemOf({ end }),
  ];
  return groupBotActivity({
    items: items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => a.item.at.localeCompare(b.item.at) || a.index - b.index)
      .map(({ item }) => item),
    comments: null,
    entries: [],
  });
};
