import { useCallback, useEffect, useState } from 'react';
import type { ArtifactRevisionAuthor } from '@goodboy/db';
import type { ArtifactId } from '@goodboy/types';
import { listArtifactRevisions } from '../../../artifacts';

export type PlanVersionNote = Readonly<{
  revision: number;
  author: ArtifactRevisionAuthor;
}>;

const AUTHOR_LABEL: Readonly<Record<ArtifactRevisionAuthor, string>> = {
  agent: 'Revised by planner',
  user: 'Edited by you',
  restore: 'Restored by you',
  import: 'Imported',
};

type Params = Readonly<{
  artifactId: ArtifactId;
  version: number;
}>;

export type PlanVersionNotes = Readonly<{
  note: PlanVersionNote | null;
  remember: (note: PlanVersionNote) => void;
}>;

export const planVersionNoteLabel = ({ note }: { readonly note: PlanVersionNote }): string =>
  `v${note.revision} · ${AUTHOR_LABEL[note.author]}`;

export const usePlanVersionNote = ({ artifactId, version }: Params): PlanVersionNotes => {
  const [loaded, setLoaded] = useState<PlanVersionNote | null>(null);
  const [remembered, setRemembered] = useState<PlanVersionNote | null>(null);

  useEffect(() => {
    if (version < 2) {
      return;
    }
    let isCurrent = true;
    listArtifactRevisions(artifactId)
      .then((revisions) => {
        const found = revisions.find((candidate) => candidate.revision === version);
        if (isCurrent && found !== undefined) {
          setLoaded({ revision: found.revision, author: found.author });
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [artifactId, version]);

  const remember = useCallback((note: PlanVersionNote) => setRemembered(note), []);

  if (version < 2) {
    return { note: null, remember };
  }
  const note = [remembered, loaded].find(
    (candidate) => candidate !== null && candidate.revision === version,
  );
  return { note: note ?? null, remember };
};
