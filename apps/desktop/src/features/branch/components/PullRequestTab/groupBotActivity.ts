import { isBotLogin } from '@goodboy/core/review-source';
import type { PrComment } from '@goodboy/types';
import type { ThreadEntry } from '../../../resolve/commentGroupsView';
import type { ActivityItem } from './activityOf';
import { botCommentCountOf } from './botCommentCountOf';
import { botKeyOf } from './botKeyOf';
import { botWordOf } from './botWordOf';

type Params = {
  readonly items: ReadonlyArray<ActivityItem>;
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly entries: ReadonlyArray<ThreadEntry>;
};

type ItemParams = {
  readonly item: ActivityItem;
};

const botKeyOfItem = ({ item }: ItemParams): string | null =>
  item.kind === 'review' &&
  item.verdict === 'commented' &&
  isBotLogin({ login: item.who, ...(item.isBot === undefined ? {} : { isBot: item.isBot }) })
    ? botKeyOf({ login: item.who })
    : null;

export const groupBotActivity = ({
  items,
  comments,
  entries,
}: Params): ReadonlyArray<ActivityItem> => {
  const keys = items.map((item) => botKeyOfItem({ item }));
  return items.flatMap((item, index): ReadonlyArray<ActivityItem> => {
    const key = keys[index] ?? null;
    if (key === null || item.kind !== 'review') {
      return [item];
    }
    if (keys.lastIndexOf(key) !== index) {
      return [];
    }
    const said = botWordOf({
      bot: {
        person: { login: item.who, name: null, avatarUrl: null, isBot: true },
        state: 'commented',
      },
      comments,
      entries,
    });
    const notes = items.flatMap((other, position) =>
      keys[position] === key && other.kind === 'review' && other.text !== '' ? [other.text] : [],
    );
    return [
      {
        kind: 'bot',
        key: `bot:${key}`,
        at: item.at,
        who: item.who,
        avatarUrl: item.avatarUrl ?? null,
        word: said.word,
        tone: said.tone,
        count: botCommentCountOf({
          login: item.who,
          comments,
          reviews: items.flatMap((other) =>
            other.kind === 'review'
              ? [{ author: other.who, state: other.verdict, body: other.text }]
              : [],
          ),
        }),
        notes,
      },
    ];
  });
};
