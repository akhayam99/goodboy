import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { EmptyState, PaneShell } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import {
  historyCandidatesOf,
  historyFoldersOf,
} from '../../../../../store/slices/project-mounts/inPlaceFoldersOf';
import { ChangesPane } from './ChangesPane';
import { FileVersionsPane } from './FileVersionsPane';

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string | null;
  readonly onClose: () => void;
};

export const FilesPane = ({ sessionId, sessionDir, onClose }: Props) => {
  const isInPlace = useAppStore((state) => historyFoldersOf({ state, sessionId }).length > 0);
  const hasCandidates = useAppStore(
    (state) => historyCandidatesOf({ state, sessionId }).length > 0,
  );
  const loadSessionFolderTurns = useAppStore((state) => state.loadSessionFolderTurns);
  useEffect(() => {
    if (!hasCandidates) {
      return;
    }
    void loadSessionFolderTurns({ sessionId });
  }, [hasCandidates, loadSessionFolderTurns, sessionId]);
  if (isInPlace) {
    return <ChangesPane sessionId={sessionId} />;
  }
  if (sessionDir == null) {
    return (
      <PaneShell title="Changes">
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="Session folder missing"
          description="This session's folder is not available, so its saved versions cannot be loaded."
        />
      </PaneShell>
    );
  }
  return <FileVersionsPane sessionId={sessionId} sessionDir={sessionDir} onClose={onClose} />;
};
