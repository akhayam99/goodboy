import type { SessionId } from '@goodboy/types';
import type { WorktreeEntryFacts } from './worktreeEntryFacts';

type Published = {
  readonly sessionId: SessionId;
  readonly facts: WorktreeEntryFacts;
};

type PublishParams = Published;

type ClearParams = {
  readonly sessionId: SessionId;
};

let current: Published | null = null;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const worktreeEntryFactsBus = {
  get: (): Published | null => current,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  publish: ({ sessionId, facts }: PublishParams): void => {
    if (current !== null && current.sessionId === sessionId && current.facts === facts) {
      return;
    }
    current = { sessionId, facts };
    notify();
  },
  clear: ({ sessionId }: ClearParams): void => {
    if (current === null || current.sessionId !== sessionId) {
      return;
    }
    current = null;
    notify();
  },
};
