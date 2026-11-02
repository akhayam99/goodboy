import type { SlackThreadGroup } from '../../integrations/slack/SlackStudio/useSlackThreads';
import type { InboxRecord } from '../types';
import { countNoun } from '../../../shared/utils/countNoun';

type Params = {
  readonly groups: ReadonlyArray<SlackThreadGroup>;
  readonly now: Date;
};

type SameDayParams = {
  readonly iso: string;
  readonly now: Date;
};

const isSameDay = ({ iso, now }: SameDayParams): boolean => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return false;
  }
  return (
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate()
  );
};

export const adaptSlackThreads = ({ groups, now }: Params): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map(({ channel, head, sessionId }) => {
      const updatedAt = head.latestReplyAt ?? head.postedAt ?? '';
      const isActive = isSameDay({ iso: updatedAt, now });
      return {
        key: `slack:thread:${channel.id}:${head.threadTs ?? head.ts}`,
        provider: 'slack',
        kind: 'thread',
        identifier: `#${channel.name}`,
        title: head.text,
        state: isActive ? 'active' : 'open',
        stateLabel: isActive ? 'Active' : 'Open',
        updatedAt,
        url: '',
        context: `${countNoun({ count: head.replyCount, one: 'reply', many: 'replies' })}`,
        payload: { provider: 'slack', kind: 'thread', channel, head, sessionId },
      };
    }),
  );
