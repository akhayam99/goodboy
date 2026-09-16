import { useEffect, useMemo, useState } from 'react';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  defaultArtifactDraft,
  isArtifactDraftEmpty,
} from '../../../../../store/slices/artifactDrafts/defaultArtifactDraft';
import type {
  ArtifactBasedOn,
  ArtifactCreationDraft,
  ArtifactCreationRouting,
} from '../../../../../store/slices/artifactDrafts/types';
import type { GeneratedArtifactKind } from '../../../artifactCollection';
import { ARTIFACT_CREATION_ADAPTERS } from '../../../artifactCreationAdapters';

export type ArtifactCreationDraftHandle = Readonly<{
  draft: ArtifactCreationDraft;
  brief: string;
  choice: string;
  basedOn: ArtifactBasedOn;
  routing: ArtifactCreationRouting | null;
  isEmpty: boolean;
  setBrief: (brief: string) => void;
  setChoice: (choice: string) => void;
  setBasedOn: (basedOn: ArtifactBasedOn) => void;
  setRouting: (routing: ArtifactCreationRouting | null) => void;
}>;

type Params = Readonly<{
  sessionId: SessionId;
  kind: GeneratedArtifactKind;
}>;

const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

export const useArtifactCreationDraft = ({
  sessionId,
  kind,
}: Params): ArtifactCreationDraftHandle => {
  const adapter = ARTIFACT_CREATION_ADAPTERS[kind];
  const stored = useAppStore((s) => s.artifactDrafts[sessionId]?.[kind]);
  const setArtifactDraft = useAppStore((s) => s.setArtifactDraft);
  const clearArtifactDraft = useAppStore((s) => s.clearArtifactDraft);
  const [initial] = useState<ArtifactCreationDraft>(
    () => stored ?? defaultArtifactDraft({ kind, now: now() }),
  );
  const [brief, setBrief] = useState(initial.brief);
  const [choice, setChoice] = useState(adapter.choiceOf({ draft: initial }));
  const [basedOn, setBasedOn] = useState<ArtifactBasedOn>(initial.basedOn);
  const [routing, setRouting] = useState<ArtifactCreationRouting | null>(initial.routing);

  const draft = useMemo<ArtifactCreationDraft>(
    () => adapter.withChoice({ draft: { ...initial, brief, basedOn, routing }, choice }),
    [adapter, initial, brief, basedOn, routing, choice],
  );
  const isEmpty = isArtifactDraftEmpty({ draft });

  useEffect(() => {
    if (isEmpty) {
      clearArtifactDraft({ sessionId, kind });
      return;
    }
    setArtifactDraft({ sessionId, draft: { ...draft, updatedAt: now() } });
  }, [draft, isEmpty, sessionId, kind, setArtifactDraft, clearArtifactDraft]);

  return {
    draft,
    brief,
    choice,
    basedOn,
    routing,
    isEmpty,
    setBrief,
    setChoice,
    setBasedOn,
    setRouting,
  };
};
