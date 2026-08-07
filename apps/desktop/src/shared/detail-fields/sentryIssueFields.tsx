import type { SentryTag } from '../../features/integrations/sentry/client';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

export type SentryIssueProperties = {
  readonly culprit: string | null;
  readonly status: string | null;
  readonly count: string | null;
  readonly userCount: number | null;
  readonly firstSeen: string | null;
  readonly lastSeen: string | null;
  readonly tags: ReadonlyArray<SentryTag>;
};

export const sentryIssueFields: DetailFieldRegistry<SentryIssueProperties> = [
  {
    kind: 'field',
    key: 'culprit',
    label: 'Culprit',
    render: ({ entity }) => <span className="font-mono text-2xs">{entity.culprit}</span>,
  },
  {
    kind: 'field',
    key: 'status',
    label: 'Status',
    render: ({ entity }) => entity.status,
  },
  {
    kind: 'field',
    key: 'events',
    label: 'Events',
    render: ({ entity }) => <span className="tabular-nums">{entity.count}</span>,
  },
  {
    kind: 'field',
    key: 'users',
    label: 'Users',
    render: ({ entity }) => {
      if (entity.userCount == null) {
        return null;
      }
      return <span className="tabular-nums">{String(entity.userCount)}</span>;
    },
  },
  {
    kind: 'field',
    key: 'firstSeen',
    label: 'First seen',
    render: ({ entity }) => {
      if (entity.firstSeen == null) {
        return null;
      }
      return formatAbsoluteDateTime({ iso: entity.firstSeen });
    },
  },
  {
    kind: 'field',
    key: 'lastSeen',
    label: 'Last seen',
    render: ({ entity }) => {
      if (entity.lastSeen == null) {
        return null;
      }
      return formatAbsoluteDateTime({ iso: entity.lastSeen });
    },
  },
  {
    kind: 'group',
    key: 'tags',
    expand: ({ entity }) =>
      entity.tags.map((tag) => ({ key: `tag-${tag.key}`, label: tag.key, node: tag.value })),
  },
];
