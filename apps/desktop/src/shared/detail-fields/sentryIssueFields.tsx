import { Activity, Code2, Tag } from 'lucide-react';
import type { SentryTag } from '../../features/integrations/sentry/client';
import { SentryLevelBadge } from '../../features/integrations/sentry/SentryLevelBadge';
import { stateWord } from '../../features/inbox/stateWord';
import type { InboxState } from '../../features/inbox/types';
import { RecordState } from '../components/StudioDetail/RecordState';
import type { FactRegistry } from './factTypes';

export type SentryIssueProperties = {
  readonly status: string | null;
  readonly level: string | null;
  readonly culprit: string | null;
  readonly count: string | null;
  readonly userCount: number | null;
  readonly lastSeen: string | null;
  readonly tags: ReadonlyArray<SentryTag>;
};

type StateCategoryParams = {
  readonly status: string | null;
};

export const sentryStateCategory = ({ status }: StateCategoryParams): InboxState =>
  status === 'resolved' || status === 'ignored' ? 'done' : 'alert';

const MAX_TAGS = 3;

type MeasureParams = {
  readonly count: string | null;
  readonly userCount: number | null;
};

const measureOf = ({ count, userCount }: MeasureParams): string | null => {
  const parts = [
    count == null || count === '' ? null : `${count} events`,
    userCount == null ? null : `${userCount} ${userCount === 1 ? 'user' : 'users'}`,
  ].filter((part): part is string => part != null);
  return parts.length === 0 ? null : parts.join(' · ');
};

export const sentryIssueFields: FactRegistry<SentryIssueProperties> = {
  state: ({ entity }) => ({
    key: 'state',
    label: 'Status',
    icon: null,
    node: (
      <RecordState
        category={sentryStateCategory({ status: entity.status })}
        label={stateWord({ value: entity.status ?? 'unresolved' })}
      />
    ),
  }),
  weight: ({ entity }) =>
    entity.level == null
      ? null
      : {
          key: 'level',
          label: 'Level',
          icon: null,
          node: <SentryLevelBadge level={entity.level} density="compact" />,
        },
  place: ({ entity }) => ({
    key: 'culprit',
    label: 'Culprit',
    icon: Code2,
    node: entity.culprit == null ? null : <span className="font-mono">{entity.culprit}</span>,
  }),
  labels: ({ entity }) =>
    entity.tags.slice(0, MAX_TAGS).map((tag) => ({
      key: `tag-${tag.key}`,
      label: tag.key,
      icon: Tag,
      node: `${tag.key}: ${tag.value}`,
    })),
  measure: ({ entity }) => ({
    key: 'events',
    label: 'Events and users',
    icon: Activity,
    node: measureOf({ count: entity.count, userCount: entity.userCount }),
  }),
};
