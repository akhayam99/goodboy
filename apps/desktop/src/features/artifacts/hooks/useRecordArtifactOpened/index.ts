import { useEffect } from 'react';
import type { ArtifactId } from '@goodboy/types';
import { recordArtifactOpened } from '../../recordArtifactOpened';

type Params = {
  readonly artifactId: ArtifactId | null;
};

export const useRecordArtifactOpened = ({ artifactId }: Params): void => {
  useEffect(() => {
    if (artifactId === null) {
      return;
    }
    void recordArtifactOpened({ artifactId }).catch(() => undefined);
  }, [artifactId]);
};
