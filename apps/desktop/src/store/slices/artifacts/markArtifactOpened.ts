import type { ArtifactId, IsoDateTime, SessionId } from '@goodboy/types';
import type { SetFn } from './types';

export type MarkArtifactOpenedParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const markArtifactOpened = (set: SetFn) => {
  return ({ sessionId, artifactId }: MarkArtifactOpenedParams): void => {
    const openedAt = new Date().toISOString() as IsoDateTime;
    set((state) => {
      const current = state.sessionArtifacts[sessionId] ?? [];
      const target = current.find((candidate) => candidate.id === artifactId);
      if (target === undefined || target.openedAt !== null) {
        return {};
      }
      return {
        sessionArtifacts: {
          ...state.sessionArtifacts,
          [sessionId]: current.map((candidate) =>
            candidate.id === artifactId ? { ...candidate, openedAt } : candidate,
          ),
        },
      };
    });
  };
};
