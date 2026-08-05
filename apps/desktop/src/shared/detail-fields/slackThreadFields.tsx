import { Chip } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

export type SlackThreadProperties = {
  readonly channelName: string;
  readonly participants: ReadonlyArray<string>;
  readonly replyCount: number;
  readonly lastActivityAt: IsoDateTime | null;
};

export const slackThreadFields: DetailFieldRegistry<SlackThreadProperties> = [
  {
    kind: 'field',
    key: 'channel',
    label: 'Channel',
    render: ({ entity }) => `#${entity.channelName}`,
  },
  {
    kind: 'field',
    key: 'participants',
    label: 'In the thread',
    render: ({ entity }) =>
      entity.participants.map((participant) => (
        <Chip key={participant} tone="neutral" shape="badge" bordered={false} label={participant} />
      )),
  },
  {
    kind: 'field',
    key: 'replyCount',
    label: 'Replies',
    render: ({ entity }) => (entity.replyCount > 0 ? String(entity.replyCount) : null),
  },
  {
    kind: 'field',
    key: 'lastActivity',
    label: 'Last activity',
    render: ({ entity }) =>
      entity.lastActivityAt != null ? formatAbsoluteDateTime({ iso: entity.lastActivityAt }) : null,
  },
];
