import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { SessionCreation, SessionCreationId, SessionCreationKind, SetFn } from './types';

export const beginSessionCreation = (set: SetFn) => {
  return (
    sessionId: SessionId,
    creation: { readonly kind: SessionCreationKind; readonly label?: string | null },
  ): SessionCreationId => {
    const entry: SessionCreation = {
      id: crypto.randomUUID(),
      kind: creation.kind,
      label: creation.label ?? null,
      startedAt: new Date().toISOString() as IsoDateTime,
    };
    set((s) => ({
      sessionCreations: {
        ...s.sessionCreations,
        [sessionId]: [...(s.sessionCreations[sessionId] ?? []), entry],
      },
    }));
    return entry.id;
  };
};

export const endSessionCreation = (set: SetFn) => {
  return (sessionId: SessionId, creationId: SessionCreationId): void => {
    set((s) => {
      const current = s.sessionCreations[sessionId] ?? [];
      const next = current.filter((entry) => entry.id !== creationId);
      if (next.length === current.length) {
        return {};
      }
      return { sessionCreations: { ...s.sessionCreations, [sessionId]: next } };
    });
  };
};
