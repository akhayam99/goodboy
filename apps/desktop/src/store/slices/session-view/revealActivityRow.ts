import type { SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export const revealActivityRow = (set: SetFn) => {
  return (sessionId: SessionId, rowId: string): void => {
    set((s) => {
      const current = s.revealedActivityRows[sessionId] ?? new Set<string>();
      if (current.has(rowId)) {
        return s;
      }
      const next = new Set(current);
      next.add(rowId);
      return { revealedActivityRows: { ...s.revealedActivityRows, [sessionId]: next } };
    });
  };
};
