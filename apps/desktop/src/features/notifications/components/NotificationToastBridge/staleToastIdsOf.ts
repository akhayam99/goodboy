import type { Notification } from '@goodboy/db';

type Params = {
  readonly shownIds: ReadonlySet<string>;
  readonly notifications: ReadonlyArray<Notification>;
};

export const staleToastIdsOf = ({ shownIds, notifications }: Params): ReadonlySet<string> => {
  const current = new Set(
    notifications
      .filter((notification) => !notification.read)
      .map((notification) => notification.id),
  );
  return new Set([...shownIds].filter((id) => !current.has(id)));
};
