import type { PrComment, PullRequestReviewer } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { countNoun } from '../../../../shared/utils/countNoun';
import { REVIEWER_STATE_WORD } from './reviewerStateWord';

type Params = {
  readonly bot: PullRequestReviewer;
  readonly comments: ReadonlyArray<PrComment> | null;
};

export type BotWord = {
  readonly word: string;
  readonly tone: Tone;
};

const BOT_SUFFIX = '[bot]';

type LoginParams = {
  readonly login: string;
};

const botKeyOf = ({ login }: LoginParams): string => {
  const lower = login.toLowerCase();
  return lower.endsWith(BOT_SUFFIX) ? lower.slice(0, -BOT_SUFFIX.length) : lower;
};

export const botWordOf = ({ bot, comments }: Params): BotWord => {
  const key = botKeyOf({ login: bot.person.login });
  const heads = (comments ?? []).filter(
    (comment) =>
      comment.source === 'review' &&
      comment.inReplyToId === undefined &&
      botKeyOf({ login: comment.author }) === key,
  );
  const open = heads.filter((head) => head.resolved !== true).length;
  if (open > 0) {
    return { word: countNoun({ count: open, one: 'issue' }), tone: 'warning' };
  }
  if (heads.length > 0) {
    return { word: `${heads.length} resolved`, tone: 'neutral' };
  }
  return { word: REVIEWER_STATE_WORD[bot.state], tone: 'neutral' };
};
