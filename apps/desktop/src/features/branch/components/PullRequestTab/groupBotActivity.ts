import { isBotLogin } from '@goodboy/core';
import type { ActivityItem } from './activityOf';

type Params = {
  readonly items: ReadonlyArray<ActivityItem>;
};

type BotComment = {
  readonly who: string;
  readonly text: string;
};

type ItemParams = {
  readonly item: ActivityItem;
};

const botCommentOf = ({ item }: ItemParams): BotComment | null =>
  item.kind === 'review' && item.verdict === 'commented' && isBotLogin({ login: item.who })
    ? { who: item.who, text: item.text }
    : null;

export const groupBotActivity = ({ items }: Params): ReadonlyArray<ActivityItem> =>
  items.reduce<ReadonlyArray<ActivityItem>>((grouped, item) => {
    const comment = botCommentOf({ item });
    if (comment === null) {
      return [...grouped, item];
    }
    const last = grouped[grouped.length - 1];
    if (last !== undefined && last.kind === 'bots') {
      return [
        ...grouped.slice(0, -1),
        { ...last, at: item.at, comments: [...last.comments, comment] },
      ];
    }
    return [
      ...grouped,
      { kind: 'bots', key: `bots:${item.key}`, at: item.at, comments: [comment] },
    ];
  }, []);
