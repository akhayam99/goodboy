import type { SessionId } from '@goodboy/types';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { DiffViewerPane } from '../../../../permissions/components/DiffViewerDialog';
import { DIFF_VIEWER_PANE_COPY } from '../../../../permissions/components/DiffViewerDialog/diffViewerPaneCopy';
import { PaneShell } from './PaneShell';

type FilesPaneProps = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly worktreePath: string | null;
  readonly onClose: () => void;
};

export const FilesPane = ({ sessionId, workingDir, worktreePath, onClose }: FilesPaneProps) => {
  if (worktreePath == null) {
    return (
      <PaneShell
        title={DIFF_VIEWER_PANE_COPY.title}
        description={DIFF_VIEWER_PANE_COPY.description}
      >
        <EmptyState
          bordered
          tone="info"
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
      workingDir={workingDir ?? undefined}
      worktreePath={worktreePath}
      onClose={onClose}
    />
  );
};
