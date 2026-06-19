import type { WorkspaceId } from '@goodboy/types';
import { Button, Dialog } from '@goodboy/ui';
import { GithubFormBody } from './GithubFormBody';

type Props = {
  workspaceId: WorkspaceId;
  open: boolean;
  onClose: () => void;
};

export const ConnectGithubDialog = ({ workspaceId, open, onClose }: Props) => (
  <Dialog
    open={open}
    onClose={onClose}
    title="Connect GitHub"
    description="Per-workspace token (classic, scope repo). Stored in your OS keychain."
    size="md"
    footer={
      <Button variant="ghost" onClick={onClose}>
        Close
      </Button>
    }
  >
    {open ? <GithubFormBody workspaceId={workspaceId} /> : null}
  </Dialog>
);
