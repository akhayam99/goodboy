import type { SessionId } from '@goodboy/types';
import { locationKey } from './locationKey';
import { EMPTY_FOCUS, HISTORY_LIMIT, type Location, type NavigationStack } from './types';

type SyncParams = {
  readonly stack: NavigationStack | undefined;
  readonly live: Location;
};

const isSamePlace = (left: Location, right: Location): boolean =>
  locationKey({ place: left.place }) === locationKey({ place: right.place });

export const syncTop = ({ stack, live }: SyncParams): NavigationStack => {
  const top = stack?.entries[stack.index];
  if (stack === undefined || top === undefined) {
    return { entries: [live], index: 0 };
  }
  const synced: Location = isSamePlace(top, live) ? { ...live, focus: top.focus } : live;
  return {
    entries: stack.entries.map((entry, index) => (index === stack.index ? synced : entry)),
    index: stack.index,
  };
};

type PushParams = {
  readonly stack: NavigationStack;
  readonly next: Location;
};

export const pushEntry = ({ stack, next }: PushParams): NavigationStack => {
  const top = stack.entries[stack.index];
  if (top !== undefined && isSamePlace(top, next)) {
    return replaceTop({ stack, next });
  }
  const entries = [...stack.entries.slice(0, stack.index + 1), next];
  const overflow = Math.max(entries.length - HISTORY_LIMIT, 0);
  const trimmed = entries.slice(overflow);
  return { entries: trimmed, index: trimmed.length - 1 };
};

export const replaceTop = ({ stack, next }: PushParams): NavigationStack => ({
  entries: stack.entries.map((entry, index) => (index === stack.index ? next : entry)),
  index: stack.index,
});

type StudioParams = {
  readonly stack: NavigationStack;
  readonly base: Location;
};

const isSessionStudio = (entry: Location | undefined): boolean =>
  entry !== undefined && entry.place.at === 'session' && entry.place.view.studio !== null;

export const closeSideTrips = ({ stack, base }: StudioParams): NavigationStack => {
  let floor = stack.index;
  while (floor >= 0 && isSessionStudio(stack.entries[floor])) {
    floor -= 1;
  }
  const below = stack.entries[floor];
  if (below !== undefined && isSamePlace(below, base)) {
    return { entries: stack.entries.slice(0, floor + 1), index: floor };
  }
  const entries = [...stack.entries.slice(0, floor + 1), { ...base, focus: EMPTY_FOCUS }];
  return { entries, index: entries.length - 1 };
};

type DropParams = {
  readonly stack: NavigationStack;
  readonly sessionId: SessionId;
};

export const dropSession = ({ stack, sessionId }: DropParams): NavigationStack => {
  const kept: Array<Location> = [];
  let index = -1;
  stack.entries.forEach((entry, position) => {
    const isGone = entry.place.at === 'session' && entry.place.sessionId === sessionId;
    const previous = kept[kept.length - 1];
    const isDuplicate = previous !== undefined && isSamePlace(previous, entry);
    if (!isGone && !isDuplicate) {
      kept.push(entry);
    }
    if (position <= stack.index) {
      index = kept.length - 1;
    }
  });
  return { entries: kept, index: Math.max(index, 0) };
};
