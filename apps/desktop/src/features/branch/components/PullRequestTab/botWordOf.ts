import type { PrComment, PullRequestReviewer } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { countNoun } from '../../../../shared/utils/countNoun';
import {
  commentStateCountsOf,
  entriesInScopeOf,
  type ThreadEntry,
} from '../../../resolve/commentGroupsView';
import { botKeyOf } from './botKeyOf';
import { reviewHeadsOf } from './reviewHeadsOf';
import { REVIEWER_STATE_WORD } from './reviewerStateWord';

type Params = {
  readonly bot: PullRequestReviewer;
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly entries: ReadonlyArray<ThreadEntry>;
};

export type BotWord = {
  readonly word: string;
  readonly tone: Tone;
};

type BotTally = {
  readonly open: number;
  readonly raised: number;
};

const botTallyOf = ({ bot, comments, entries }: Params): BotTally => {
  const key = botKeyOf({ login: bot.person.login });
  const heads = reviewHeadsOf({ comments, botKey: key });
  const hostEntries = entriesInScopeOf({ entries, scope: 'comments' });
  if (hostEntries.length === 0) {
    return {
      open: heads.filter((head) => head.resolved !== true).length,
      raised: heads.length,
    };
  }
  const byThread = new Map(hostEntries.map((entry) => [entry.threadId, entry]));
  const tracked = heads.flatMap((head) => byThread.get(head.threadId ?? head.id) ?? []);
  return { open: commentStateCountsOf({ entries: tracked }).open, raised: tracked.length };
};

export const botWordOf = ({ bot, comments, entries }: Params): BotWord => {
  const { open, raised } = botTallyOf({ bot, comments, entries });
  if (open > 0) {
    return { word: countNoun({ count: open, one: 'issue' }), tone: 'warning' };
  }
  if (raised > 0) {
    return { word: `${raised} resolved`, tone: 'neutral' };
  }
  return { word: REVIEWER_STATE_WORD[bot.state], tone: 'neutral' };
};
