import type { SlackThreadGroup } from '../../integrations/slack/SlackStudio/useSlackThreads';
import type { InboxRecord } from '../types';
type Params = { readonly groups: ReadonlyArray<SlackThreadGroup> };
export const adaptSlackThreads = ({ groups }: Params): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map(({ channel, head, sessionId }) => ({
      key: `slack:thread:${channel.id}:${head.threadTs ?? head.ts}`,
      provider: 'slack',
      kind: 'thread',
      identifier: `#${channel.name}`,
      title: head.text,
      state: 'active',
      updatedAt: head.latestReplyAt ?? head.postedAt ?? '',
      url: '',
      meta: `${head.replyCount} replies`,
      payload: { provider: 'slack', kind: 'thread', channel, head, sessionId },
    })),
  );
