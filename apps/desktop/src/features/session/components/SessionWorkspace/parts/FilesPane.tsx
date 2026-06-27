import { FileDiff } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { EmptyState } from '@goodboy/ui';
import { useCurrentWorkspace } from '../../../../../store';
import { DiffViewerPane } from '../../../../permissions/components/DiffViewerDialog';
import { PaneShell } from './PaneShell';

type FilesPaneProps = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
  readonly onClose: () => void;
};

export const FilesPane = ({ sessionId, workingDir, onClose }: FilesPaneProps) => {
  const workspaceName = useCurrentWorkspace()?.name ?? '';

  if (!workingDir) {
    return (
      <PaneShell title="Diff" description="Changes across this session's working tree.">
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
      workspaceName={workspaceName}
      workingDir={workingDir}
      worktreePath={workingDir}
      onClose={onClose}
    />
  );
};
