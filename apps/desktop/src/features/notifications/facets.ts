import type {
  Notification,
  NotificationCountBucket,
  NotificationKind,
  NotificationSeverity,
} from '@goodboy/db';
import { NOTIFICATION_SOURCES, notificationSource, type NotificationSource } from './source';

export type NotificationView = 'all' | 'unread' | 'action';

export type NotificationSeverityFacet = 'error' | 'warning' | 'info';

export const NOTIFICATION_VIEWS = [
  'all',
  'unread',
  'action',
] as const satisfies ReadonlyArray<NotificationView>;

export const NOTIFICATION_SEVERITY_FACETS = [
  'error',
  'warning',
  'info',
] as const satisfies ReadonlyArray<NotificationSeverityFacet>;

export type NotificationFilters = {
  readonly view: NotificationView;
  readonly severity: NotificationSeverityFacet | null;
  readonly source: NotificationSource | null;
};

export const NO_NOTIFICATION_FILTERS = {
  view: 'all',
  severity: null,
  source: null,
} as const satisfies NotificationFilters;

type NotificationFacts = {
  readonly severity: NotificationSeverity;
  readonly kind: NotificationKind;
  readonly hasSession: boolean;
  readonly hasAction: boolean;
  readonly read: boolean;
};

type MatchParams = {
  readonly facts: NotificationFacts;
  readonly filters: NotificationFilters;
};

type SeverityFacetParams = {
  readonly severity: NotificationSeverity;
};

export const severityFacet = ({ severity }: SeverityFacetParams): NotificationSeverityFacet =>
  severity === 'success' ? 'info' : severity;

type ViewMatchParams = {
  readonly facts: NotificationFacts;
  readonly view: NotificationView;
};

const matchesView = ({ facts, view }: ViewMatchParams): boolean => {
  switch (view) {
    case 'all':
      return true;
    case 'unread':
      return !facts.read;
    case 'action':
      return facts.hasAction;
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
};

const matchesFilters = ({ facts, filters }: MatchParams): boolean =>
  matchesView({ facts, view: filters.view }) &&
  (filters.severity == null || severityFacet({ severity: facts.severity }) === filters.severity) &&
  (filters.source == null ||
    notificationSource({ kind: facts.kind, hasSession: facts.hasSession }) === filters.source);

type NotificationFactsParams = {
  readonly notification: Notification;
};

const notificationFacts = ({ notification }: NotificationFactsParams): NotificationFacts => ({
  severity: notification.severity,
  kind: notification.kind,
  hasSession: notification.sessionId != null,
  hasAction: notification.action != null,
  read: notification.read,
});

type NotificationMatchesParams = {
  readonly notification: Notification;
  readonly filters: NotificationFilters;
};

export const notificationMatches = ({ notification, filters }: NotificationMatchesParams) =>
  matchesFilters({ facts: notificationFacts({ notification }), filters });

type FilterGroupsParams = {
  readonly groups: ReadonlyArray<ReadonlyArray<Notification>>;
  readonly filters: NotificationFilters;
};

export const filterNotificationGroups = ({ groups, filters }: FilterGroupsParams) =>
  groups.filter((group) =>
    group.some((notification) => notificationMatches({ notification, filters })),
  );

export type NotificationFacetCounts = {
  readonly total: number;
  readonly unread: number;
  readonly matching: number;
  readonly view: Readonly<Record<NotificationView, number>>;
  readonly severity: Readonly<Record<NotificationSeverityFacet, number>>;
  readonly source: Readonly<Record<NotificationSource, number>>;
  readonly workspace: number;
  readonly all: number;
};

type CountFacetsParams = {
  readonly buckets: ReadonlyArray<NotificationCountBucket>;
  readonly filters: NotificationFilters;
  readonly isWorkspaceScoped: boolean;
};

type TallyParams<T extends string> = {
  readonly keys: ReadonlyArray<T>;
  readonly buckets: ReadonlyArray<NotificationCountBucket>;
  readonly matches: (params: { bucket: NotificationCountBucket; key: T }) => boolean;
};

const tally = <T extends string>({ keys, buckets, matches }: TallyParams<T>) =>
  Object.fromEntries(
    keys.map((key) => [
      key,
      buckets.reduce((sum, bucket) => sum + (matches({ bucket, key }) ? bucket.count : 0), 0),
    ]),
  ) as Record<T, number>;

type SumParams = {
  readonly buckets: ReadonlyArray<NotificationCountBucket>;
};

const sum = ({ buckets }: SumParams): number =>
  buckets.reduce((total, bucket) => total + bucket.count, 0);

export const countNotificationFacets = ({
  buckets,
  filters,
  isWorkspaceScoped,
}: CountFacetsParams): NotificationFacetCounts => {
  const scoped = isWorkspaceScoped ? buckets.filter((bucket) => bucket.inWorkspace) : buckets;
  return {
    total: sum({ buckets: scoped }),
    unread: sum({ buckets: scoped.filter((bucket) => !bucket.read) }),
    matching: sum({
      buckets: scoped.filter((bucket) => matchesFilters({ facts: bucket, filters })),
    }),
    view: tally({
      keys: NOTIFICATION_VIEWS,
      buckets: scoped,
      matches: ({ bucket, key }) =>
        matchesFilters({ facts: bucket, filters: { ...filters, view: key } }),
    }),
    severity: tally({
      keys: NOTIFICATION_SEVERITY_FACETS,
      buckets: scoped,
      matches: ({ bucket, key }) =>
        matchesFilters({ facts: bucket, filters: { ...filters, severity: key } }),
    }),
    source: tally({
      keys: NOTIFICATION_SOURCES,
      buckets: scoped,
      matches: ({ bucket, key }) =>
        matchesFilters({ facts: bucket, filters: { ...filters, source: key } }),
    }),
    workspace: sum({ buckets: buckets.filter((bucket) => bucket.inWorkspace) }),
    all: sum({ buckets }),
  };
};
