import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { LensEmptyState } from '../../../../../shared/components/LensEmptyState';
import { DiffViewerPane } from '../../../../permissions/components/DiffViewerDialog';
import { DIFF_VIEWER_PANE_COPY } from '../../../../permissions/components/DiffViewerDialog/diffViewerPaneCopy';
import { FileVersionsPane } from './FileVersionsPane';
import { PaneShell } from './PaneShell';

type FilesPaneProps = {
  readonly sessionId: SessionId;
  readonly sessionDir: string | null;
  readonly worktreePath: string | null;
  readonly isBranchless: boolean;
  readonly onClose: () => void;
};

export const FilesPane = ({
  sessionId,
  sessionDir,
  worktreePath,
  isBranchless,
  onClose,
}: FilesPaneProps) => {
  if (isBranchless) {
    if (sessionDir == null) {
      return (
        <PaneShell
          title="File versions"
          description="View and restore saved file copies for this session."
        >
          <LensEmptyState
            tone={CONCEPT_TONE.diff}
            icon={CONCEPT_ICONS.diff}
            title="Session directory missing"
            description="This session directory is not available, so file versions cannot be loaded."
          />
        </PaneShell>
      );
    }
    return <FileVersionsPane sessionId={sessionId} sessionDir={sessionDir} onClose={onClose} />;
  }
  if (worktreePath == null) {
    return (
      <PaneShell
        title={DIFF_VIEWER_PANE_COPY.title}
        description={DIFF_VIEWER_PANE_COPY.description}
      >
        <LensEmptyState
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No worktree for this session"
          description="This session has no checked-out worktree, so there is no diff to show."
        />
      </PaneShell>
    );
  }

  return (
    <DiffViewerPane
      sessionId={sessionId}
      workingDir={sessionDir ?? undefined}
      worktreePath={worktreePath}
      onClose={onClose}
    />
  );
};
