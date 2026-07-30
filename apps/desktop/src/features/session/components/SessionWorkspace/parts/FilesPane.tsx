import { FileDiff } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { EmptyState } from '@goodboy/ui';
import { DiffViewerPane } from '../../../../permissions/components/DiffViewerDialog';
import { DIFF_VIEWER_PANE_COPY } from '../../../../permissions/components/DiffViewerDialog/diffViewerPaneCopy';
import { PaneShell } from './PaneShell';

type FilesPaneProps = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly onClose: () => void;
};

export const FilesPane = ({ sessionId, workingDir, onClose }: FilesPaneProps) => {
  if (!workingDir) {
    return (
      <PaneShell
        title={DIFF_VIEWER_PANE_COPY.title}
        description={DIFF_VIEWER_PANE_COPY.description}
      >
        <EmptyState
          bordered
          tone="info"
          icon={FileDiff}
          title="No worktree for this session"
          description="This session has no checked-out worktree, so there is no diff to show."
        />
      </PaneShell>
    );
  }

  return (
    <DiffViewerPane
      sessionId={sessionId}
      workingDir={workingDir}
      worktreePath={workingDir}
      onClose={onClose}
    />
  );
};
