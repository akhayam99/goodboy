import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type NoteParams = {
  readonly sessionId: SessionId;
  readonly keys: ReadonlyArray<string>;
};

export const noteNextSubjects =
  ({ set }: Params) =>
  ({ sessionId, keys }: NoteParams): void => {
    set((state) => {
      const seen = state.nextSeenSubjects[sessionId] ?? [];
      const known = new Set(seen);
      const fresh = keys.filter((key, index) => !known.has(key) && keys.indexOf(key) === index);
      if (fresh.length === 0) {
        return {};
      }
      return {
        nextSeenSubjects: { ...state.nextSeenSubjects, [sessionId]: [...seen, ...fresh] },
      };
    });
  };
