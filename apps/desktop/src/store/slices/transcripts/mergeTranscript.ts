import type { StoredTurnEvent } from '@goodboy/db';
import type { TurnEvent } from '@goodboy/types';
import { turnEventIds } from './turnEventIds';

type MergeParams = {
  readonly stored: ReadonlyArray<StoredTurnEvent>;
  readonly live: ReadonlyArray<TurnEvent>;
};

export const mergeTranscript = ({ stored, live }: MergeParams): ReadonlyArray<TurnEvent> => {
  const storedIds = new Set(stored.map((entry) => entry.id));
  const tail = live.filter((event) => {
    const id = turnEventIds.get(event);
    return id !== undefined && !storedIds.has(id);
  });
  const events = stored.map((entry) => entry.event);
  return tail.length === 0 ? events : [...events, ...tail];
};
