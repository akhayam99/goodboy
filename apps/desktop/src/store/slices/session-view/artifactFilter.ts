import type { SessionId } from '@goodboy/types';
import type { ArtifactFilter } from '../../../features/artifacts/artifactCollection';
import type { SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  filter: ArtifactFilter;
}>;

export const setArtifactFilter = (set: SetFn) => {
  return ({ sessionId, filter }: Params): void => {
    set((s) => ({ artifactFilter: { ...s.artifactFilter, [sessionId]: filter } }));
  };
};
