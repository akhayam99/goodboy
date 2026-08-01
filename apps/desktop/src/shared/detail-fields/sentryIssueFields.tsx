import type { SentryTag } from '../../features/integrations/sentry/client';
import type { DetailFieldRegistry } from './types';

export type SentryIssueProperties = {
  readonly culprit: string | null;
  readonly status: string | null;
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
    kind: 'group',
    key: 'tags',
    expand: ({ entity }) =>
      entity.tags.map((tag) => ({ key: `tag-${tag.key}`, label: tag.key, node: tag.value })),
  },
];
