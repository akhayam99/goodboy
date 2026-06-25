import type { WorkspaceId } from '@goodboy/types'
import { Button, Dialog } from '@goodboy/ui'
import { LinearFormBody } from './LinearFormBody'

type Props = {
  workspaceId: WorkspaceId
  open: boolean
  onClose: () => void
}

export const ConnectLinearDialog = ({ workspaceId, open, onClose }: Props) => (
  <Dialog
    open={open}
    onClose={onClose}
    title="Connect Linear"
    description="Personal access token. Stored in your OS keychain."
    size="md"
    footer={
      <Button variant="ghost" onClick={onClose}>
        Close
      </Button>
    }
  >
    {open ? <LinearFormBody workspaceId={workspaceId} /> : null}
  </Dialog>
)
