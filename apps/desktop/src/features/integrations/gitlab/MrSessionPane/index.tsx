import { GitMerge } from 'lucide-react'
import type { SessionId } from '@goodboy/types'
import { MrDetailPanel } from '../GitlabStudio/MrDetailPanel'
import { StudioShell } from '../../../../shared/components/StudioShell'

type Props = {
  readonly sessionId: SessionId
  readonly workspaceName: string
  readonly onClose: () => void
}

export const MrSessionPane = ({ sessionId, workspaceName, onClose }: Props) => (
  <StudioShell
    icon={GitMerge}
    title="Merge request"
    workspaceName={workspaceName}
    closeLabel="close merge request"
    onClose={onClose}
    variant="slot"
  >
    {(requestClose) => (
      <div className="min-h-0 flex-1">
        <MrDetailPanel sessionId={sessionId} onClose={requestClose} />
      </div>
    )}
  </StudioShell>
)
