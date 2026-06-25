import type { WorkspaceId } from '@goodboy/types'
import { Button, Dialog } from '@goodboy/ui'
import { SentryFormBody } from './SentryFormBody'

type Props = {
  workspaceId: WorkspaceId
  open: boolean
  onClose: () => void
}

export const ConnectSentryDialog = ({ workspaceId, open, onClose }: Props) => (
  <Dialog
    open={open}
    onClose={onClose}
    title="Connect Sentry"
    description="Auth token plus org and project slugs. Stored in your OS keychain."
    size="md"
    footer={
      <Button variant="ghost" onClick={onClose}>
        Close
      </Button>
    }
  >
    {open ? <SentryFormBody workspaceId={workspaceId} /> : null}
  </Dialog>
)
