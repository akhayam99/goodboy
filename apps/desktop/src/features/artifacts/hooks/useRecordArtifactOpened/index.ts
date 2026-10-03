import { useEffect } from 'react';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { recordArtifactOpened } from '../../recordArtifactOpened';

type Params = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId | null;
};

export const useRecordArtifactOpened = ({ sessionId, artifactId }: Params): void => {
  const markArtifactOpened = useAppStore((s) => s.markArtifactOpened);
  useEffect(() => {
    if (artifactId === null) {
      return;
    }
    markArtifactOpened({ sessionId, artifactId });
    void recordArtifactOpened({ artifactId }).catch(() => undefined);
  }, [sessionId, artifactId, markArtifactOpened]);
};
