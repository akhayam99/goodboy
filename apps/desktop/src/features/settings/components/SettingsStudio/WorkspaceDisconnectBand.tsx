import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Button, FieldRow, InlineConfirm } from '@goodboy/ui';
import { Unplug } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { selectLiveWork } from '../../../../store/slices/live-work/selectLiveWork';

type DisconnectTitleParams = {
  readonly name: string;
  readonly runningCount: number;
};

const disconnectTitle = ({ name, runningCount }: DisconnectTitleParams): string => {
  if (runningCount === 0) {
    return `Disconnect ${name}?`;
  }
  return `Disconnect ${name} and stop ${runningCount} active ${runningCount === 1 ? 'session' : 'sessions'}?`;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly requestClose: () => void;
};

export const WorkspaceDisconnectBand = ({ workspaceId, requestClose }: Props) => {
  const disconnect = useAppStore((s) => s.disconnectWorkspace);
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.name ?? null,
  );
  const runningCount = useAppStore((s) =>
    s.currentWorkspaceId === workspaceId ? selectLiveWork({ state: s }).liveSessionIds.length : 0,
  );
  const reportError = useAppStore((s) => s.reportError);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const onDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect(workspaceId);
      requestClose();
    } catch (err) {
      void reportError({ title: "Couldn't disconnect the workspace", error: err, workspaceId });
      setIsDisconnecting(false);
    }
  };

  return (
    <Band
      inset="content"
      label="Disconnect workspace"
      ariaLabel="Disconnect workspace"
      hint="Nothing on disk is deleted."
      icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
          title={disconnectTitle({ name: workspaceName ?? 'this workspace', runningCount })}
          description="Projects, branches and worktrees stay on disk. Choose Open a folder with the same folder to bring it back with its sessions."
          confirmLabel="Disconnect"
          isBusy={isDisconnecting}
          onConfirm={onDisconnect}
          onCancel={() => setIsConfirming(false)}
          className="self-stretch text-left"
        />
      ) : (
        <FieldRow
          label={`Disconnect ${workspaceName ?? 'this workspace'}`}
          help="Folders and repositories stay as they are."
        >
          <Button variant="danger" size="sm" onClick={() => setIsConfirming(true)}>
            Disconnect
          </Button>
        </FieldRow>
      )}
    </Band>
  );
};
