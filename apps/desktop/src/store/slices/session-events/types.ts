import type { SessionEvent, SessionId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export const sessionEventsLoadInFlight = new Set<SessionId>();

export const sessionEventsOnceInFlight = new Set<string>();

type MergeParams = {
  readonly existing: ReadonlyArray<SessionEvent>;
  readonly next: SessionEvent;
};

export const mergeSessionEvents = ({ existing, next }: MergeParams): ReadonlyArray<SessionEvent> =>
  [...existing.filter((event) => event.id !== next.id), next].sort(
    (first, second) =>
      first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id),
  );
