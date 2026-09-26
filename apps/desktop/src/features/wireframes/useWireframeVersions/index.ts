import { useEffect, useState } from 'react';
import type { ArtifactId } from '@goodboy/types';
import { listArtifactRevisions } from '../../artifacts/artifacts';
import type { WireframeVersion } from '../wireframeVersion';

type Params = {
  readonly artifactId: ArtifactId;
  readonly revision: number;
};

export const useWireframeVersions = ({
  artifactId,
  revision,
}: Params): ReadonlyArray<WireframeVersion> => {
  const [versions, setVersions] = useState<ReadonlyArray<WireframeVersion>>([]);

  useEffect(() => {
    let isActive = true;
    listArtifactRevisions(artifactId)
      .then((rows) => {
        if (!isActive) {
          return;
        }
        setVersions(
          rows.map((row) => ({
            revision: row.revision,
            title: row.title,
            sourceText: row.sourceText,
            author: row.author,
            ask: row.ask,
            createdAt: row.createdAt,
            summary: row.summary,
          })),
        );
      })
      .catch(() => {
        if (isActive) {
          setVersions([]);
        }
      });
    return () => {
      isActive = false;
    };
  }, [artifactId, revision]);

  return versions;
};
