import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { EmptyState, PaneShell } from '@goodboy/ui';
import { FileVersionsPane } from './FileVersionsPane';

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string | null;
  readonly onClose: () => void;
};

export const FilesPane = ({ sessionId, sessionDir, onClose }: Props) => {
  if (sessionDir == null) {
    return (
      <PaneShell title="File versions">
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="Session directory missing"
          description="This session directory is not available, so file versions cannot be loaded."
        />
      </PaneShell>
    );
  }
  return <FileVersionsPane sessionId={sessionId} sessionDir={sessionDir} onClose={onClose} />;
};
