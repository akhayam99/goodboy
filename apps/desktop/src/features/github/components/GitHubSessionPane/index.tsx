import { GitPullRequest } from 'lucide-react'
import type { SessionId } from '@goodboy/types'
import { PrDetailPanel } from '../GitHubStudio/PrDetailPanel'
import { StudioShell } from '../../../../shared/components/StudioShell'

type Props = {
  readonly sessionId: SessionId
  readonly workspaceName: string
  readonly initialPrNumber?: number | null
  readonly initialThreadId?: string | null
  readonly onClose: () => void
}

export const GitHubSessionPane = ({
  sessionId,
  workspaceName,
  initialPrNumber = null,
  initialThreadId = null,
  onClose,
}: Props) => (
  <StudioShell
    icon={GitPullRequest}
    title="Pull request"
    workspaceName={workspaceName}
    closeLabel="close pull request"
    onClose={onClose}
    variant="slot"
  >
    {(requestClose) => (
      <div className="min-h-0 flex-1">
        <PrDetailPanel
          sessionId={sessionId}
          initialPrNumber={initialPrNumber}
          initialThreadId={initialThreadId}
          onClose={requestClose}
        />
      </div>
    )}
  </StudioShell>
)
