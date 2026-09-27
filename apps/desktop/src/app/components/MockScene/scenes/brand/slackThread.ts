import type { IsoDateTime } from '@goodboy/types';
import type {
  SlackChannel,
  SlackMessage,
  SlackUser,
} from '../../../../../features/integrations/slack/client';
import { BRAND_PEOPLE, BRAND_SESSION } from './canon';

const MINUTE = 60_000;

const isoAgo = (offsetMs: number): IsoDateTime =>
  new Date(Date.now() - offsetMs).toISOString() as IsoDateTime;

const tsAgo = (offsetMs: number): string => ((Date.now() - offsetMs) / 1000).toFixed(6);

export const SLACK_ONCALL_CHANNEL: SlackChannel = {
  id: 'C0MOCKONCALL',
  name: 'payments-oncall',
  isMember: true,
  topic: 'Paging for payments-api and ledger-core',
  memberCount: 14,
};

const OMAR_ID = 'U0MOCKOMAR';
const DANA_ID = 'U0MOCKDANA';
const KENJI_ID = 'U0MOCKKENJI';

export const SLACK_USERS: ReadonlyArray<SlackUser> = [
  { id: OMAR_ID, name: BRAND_PEOPLE.oncall.name, isBot: false, isDeleted: false, avatarUrl: null },
  { id: DANA_ID, name: BRAND_PEOPLE.owner.name, isBot: false, isDeleted: false, avatarUrl: null },
  {
    id: KENJI_ID,
    name: BRAND_PEOPLE.reviewer.name,
    isBot: false,
    isDeleted: false,
    avatarUrl: null,
  },
];

export const SLACK_THREAD_TS = tsAgo(95 * MINUTE);

type MessageParams = {
  readonly ts: string;
  readonly userId: string;
  readonly text: string;
  readonly ago: number;
  readonly replyCount?: number;
  readonly latestAgo?: number;
};

const message = ({
  ts,
  userId,
  text,
  ago,
  replyCount = 0,
  latestAgo,
}: MessageParams): SlackMessage => ({
  ts,
  threadTs: SLACK_THREAD_TS,
  userId,
  botId: null,
  text,
  subtype: null,
  replyCount,
  replyUserCount: replyCount === 0 ? 0 : 3,
  postedAt: isoAgo(ago),
  latestReplyAt: latestAgo === undefined ? null : isoAgo(latestAgo),
  reactions: [],
});

export const SLACK_HEAD: SlackMessage = message({
  ts: SLACK_THREAD_TS,
  userId: OMAR_ID,
  text: `Second credit again on account 88213 after a retry. Is this ${BRAND_SESSION.issue}?`,
  ago: 95 * MINUTE,
  replyCount: 3,
  latestAgo: 12 * MINUTE,
});

export const SLACK_THREAD: ReadonlyArray<SlackMessage> = [
  SLACK_HEAD,
  message({
    ts: tsAgo(80 * MINUTE),
    userId: KENJI_ID,
    text: 'Same event id twice in the logs, 40 seconds apart. Looks like the same bug.',
    ago: 80 * MINUTE,
  }),
  message({
    ts: tsAgo(40 * MINUTE),
    userId: DANA_ID,
    text: `Picked up ${BRAND_SESSION.issue} this morning. Will post here when the fix is up.`,
    ago: 40 * MINUTE,
  }),
  message({
    ts: tsAgo(12 * MINUTE),
    userId: OMAR_ID,
    text: 'Thanks. Holding the manual refunds until then.',
    ago: 12 * MINUTE,
  }),
];

export const SLACK_DRAFT_BODY = `Same bug as ${BRAND_SESSION.issue}. payments-api now credits once per processor event id. The fix is in payments-api #${BRAND_SESSION.paymentsPr}, and notify-relay #57 shows each retry, with ${BRAND_PEOPLE.reviewer.name} reviewing. Account 88213 is one of the 23 we reconcile once it merges.`;
