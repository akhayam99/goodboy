import { useEffect, useMemo, useRef, useState } from 'react';
import type { IsoDateTime, MountId, SessionId } from '@goodboy/types';
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
import type { ArtifactAttachment } from '../../../artifactAttachments';
import type { GeneratedArtifactKind } from '../../../artifactCollection';
import { ARTIFACT_CREATION_ADAPTERS } from '../../../artifactCreationAdapters';

export type ArtifactCreationDraftHandle = Readonly<{
  draft: ArtifactCreationDraft;
  brief: string;
  attachments: ReadonlyArray<ArtifactAttachment>;
  mountIds: ReadonlyArray<MountId>;
  choice: string;
  secondChoice: string;
  basedOn: ArtifactBasedOn;
  routing: ArtifactCreationRouting | null;
  isEmpty: boolean;
  setBrief: (brief: string) => void;
  setAttachments: (attachments: ReadonlyArray<ArtifactAttachment>) => void;
  setMountIds: (mountIds: ReadonlyArray<MountId>) => void;
  setChoice: (choice: string) => void;
  setSecondChoice: (choice: string) => void;
  setBasedOn: (basedOn: ArtifactBasedOn) => void;
  setRouting: (routing: ArtifactCreationRouting | null) => void;
}>;

type Params = Readonly<{
  sessionId: SessionId;
  kind: GeneratedArtifactKind;
  defaultMountIds: ReadonlyArray<MountId>;
}>;

const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

export const useArtifactCreationDraft = ({
  sessionId,
  kind,
  defaultMountIds,
}: Params): ArtifactCreationDraftHandle => {
  const adapter = ARTIFACT_CREATION_ADAPTERS[kind];
  const stored = useAppStore((s) => s.artifactDrafts[sessionId]?.[kind]);
  const setArtifactDraft = useAppStore((s) => s.setArtifactDraft);
  const clearArtifactDraft = useAppStore((s) => s.clearArtifactDraft);
  const [initial] = useState<ArtifactCreationDraft>(
    () => stored ?? defaultArtifactDraft({ kind, now: now() }),
  );
  const [brief, setBrief] = useState(initial.brief);
  const [attachments, setAttachments] = useState<ReadonlyArray<ArtifactAttachment>>(
    initial.attachments,
  );
  const [choice, setChoice] = useState(adapter.choiceOf({ draft: initial }));
  const [secondChoice, setSecondChoice] = useState(
    adapter.secondChoice?.choiceOf({ draft: initial }) ?? '',
  );
  const [basedOn, setBasedOn] = useState<ArtifactBasedOn>(initial.basedOn);
  const [routing, setRouting] = useState<ArtifactCreationRouting | null>(initial.routing);
  const [mountIds, setMountIdsState] = useState<ReadonlyArray<MountId>>(initial.mountIds);
  const isMountChoiceTouched = useRef(false);

  useEffect(() => {
    if (isMountChoiceTouched.current || mountIds.length > 0 || defaultMountIds.length === 0) {
      return;
    }
    setMountIdsState(defaultMountIds);
  }, [defaultMountIds, mountIds.length]);

  const setMountIds = (next: ReadonlyArray<MountId>): void => {
    isMountChoiceTouched.current = true;
    setMountIdsState(next);
  };

  const draft = useMemo<ArtifactCreationDraft>(() => {
    const withChoice = adapter.withChoice({
      draft: { ...initial, brief, attachments, mountIds, basedOn, routing },
      choice,
    });
    const second = adapter.secondChoice;
    return second === undefined
      ? withChoice
      : second.withChoice({ draft: withChoice, choice: secondChoice });
  }, [adapter, initial, brief, attachments, mountIds, basedOn, routing, choice, secondChoice]);
  const isEmpty = isArtifactDraftEmpty({ draft, defaultMountIds });

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
    attachments,
    mountIds,
    choice,
    secondChoice,
    basedOn,
    routing,
    isEmpty,
    setBrief,
    setAttachments,
    setMountIds,
    setChoice,
    setSecondChoice,
    setBasedOn,
    setRouting,
  };
};
