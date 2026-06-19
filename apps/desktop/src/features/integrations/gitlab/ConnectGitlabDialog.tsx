import type { WorkspaceId } from '@goodboy/types';
import { Button, Dialog } from '@goodboy/ui';
import { GitlabFormBody } from './GitlabFormBody';

type Props = {
  workspaceId: WorkspaceId;
  open: boolean;
  onClose: () => void;
};

export const ConnectGitlabDialog = ({ workspaceId, open, onClose }: Props) => (
  <Dialog
    open={open}
    onClose={onClose}
    title="Connect GitLab"
    description="Personal access token. Stored in your OS keychain."
    size="md"
    footer={
      <Button variant="ghost" onClick={onClose}>
        Close
      </Button>
    }
  >
    {open ? <GitlabFormBody workspaceId={workspaceId} /> : null}
  </Dialog>
);
