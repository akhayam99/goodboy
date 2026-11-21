import type { MountId } from '@goodboy/types';
import { WATCH } from './hooks/useGithubPolling/WATCH';

const notes = new Map<MountId, number>();
const listeners = new Set<() => void>();

const notifyListeners = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

type NoteParams = {
  readonly mountId: MountId;
  readonly at: number;
};

type SubscribeParams = {
  readonly onChange: () => void;
};

type ActiveParams = {
  readonly now: number;
};

const activeMountIds = ({ now }: ActiveParams): ReadonlyArray<MountId> =>
  [...notes].filter(([, at]) => now - at < WATCH.rerunGraceMs).map(([mountId]) => mountId);

export const rerunNotes = {
  note: ({ mountId, at }: NoteParams): void => {
    notes.set(mountId, at);
    notifyListeners();
    setTimeout(notifyListeners, WATCH.rerunGraceMs + 1);
  },
  snapshot: (): string => activeMountIds({ now: Date.now() }).join(';'),
  subscribe: ({ onChange }: SubscribeParams): (() => void) => {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  },
  reset: (): void => {
    notes.clear();
    notifyListeners();
  },
};
