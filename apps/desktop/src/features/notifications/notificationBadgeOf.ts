import type { NotificationCountBucket } from '@goodboy/db';

type Params = {
  readonly buckets: ReadonlyArray<NotificationCountBucket>;
  readonly isWorkspaceScoped: boolean;
};

export const notificationBadgeOf = ({ buckets, isWorkspaceScoped }: Params): number =>
  buckets.reduce(
    (total, bucket) =>
      !bucket.read &&
      (bucket.severity === 'error' || bucket.severity === 'warning') &&
      (!isWorkspaceScoped || bucket.inWorkspace)
        ? total + bucket.count
        : total,
    0,
  );
