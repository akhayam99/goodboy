import { FileDiff } from 'lucide-react'
import type { SessionId } from '@goodboy/types'
import { useCurrentWorkspace } from '../../../../../store'
import { DiffViewerPane } from '../../../../permissions/components/DiffViewerDialog'
import { PaneShell } from './PaneShell'

type FilesPaneProps = {
  readonly sessionId: SessionId
  readonly workingDir: string | null
  readonly onClose: () => void
}

export const FilesPane = ({ sessionId, workingDir, onClose }: FilesPaneProps) => {
  const workspaceName = useCurrentWorkspace()?.name ?? ''

  if (!workingDir) {
    return (
      <PaneShell title="Diff" description="Changes across this session's working tree.">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-6 py-8 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-md bg-muted/50"
          >
            <FileDiff size={24} className="text-muted-foreground" />
          </span>
          <p className="text-sm font-medium text-foreground">No worktree for this session</p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            This session has no checked-out worktree, so there is no diff to show.
          </p>
        </div>
      </PaneShell>
    )
  }

  return (
    <DiffViewerPane
      sessionId={sessionId}
      workspaceName={workspaceName}
      workingDir={workingDir}
      worktreePath={workingDir}
      onClose={onClose}
    />
  )
}
