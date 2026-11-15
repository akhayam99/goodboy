import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import { Unplug } from 'lucide-react';
import { useAppStore } from '../../../../store';

import { selectLiveWork } from '../../../../store/runtime/live-work/selectLiveWork';
import { DANGER_ZONE } from './dangerZone';
import { SettingRow } from './SettingRow';

const DISCONNECT_NOTE =
  'Files stay on disk. Open the folder again to restore it with its sessions.';

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
      void reportError({
        recovery: CHECK_STATE,
        title: "Couldn't disconnect the workspace",
        error: err,
        workspaceId,
      });
      setIsDisconnecting(false);
    }
  };

  return (
    <Band inset="content" label={DANGER_ZONE} ariaLabel={DANGER_ZONE} headingLevel={2}>
      <SettingRow
        label="Disconnect this workspace"
        rowKey="disconnect-workspace"
        help={DISCONNECT_NOTE}
      >
        <ConfirmPopover
          role="danger"
          icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
          title={disconnectTitle({ name: workspaceName ?? 'this workspace', runningCount })}
          description={DISCONNECT_NOTE}
          confirmLabel="Disconnect"
          isBusy={isDisconnecting}
          isOpen={isConfirming}
          onConfirm={onDisconnect}
          onCancel={() => setIsConfirming(false)}
          trigger={() => (
            <Button variant="ghost-danger" size="sm" onClick={() => setIsConfirming(true)}>
              Disconnect
            </Button>
          )}
        />
      </SettingRow>
    </Band>
  );
};
