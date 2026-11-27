import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { useAppStore, useSessionById } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/testing/selectDrawerSizing';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { DrawerHost } from '../../../DrawerHost';
import { ShellLeft } from '../../../ShellLeft';
import { shellArrangement } from '../../../../shellArrangement';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import type { ColumnActions } from '../../../ShellLeft/columnDoors';
import {
  BLOCKED_MOUNT_SESSION_ID,
  BLOCKED_MOUNT_WORKSPACE_ID,
  seedBlockedMountStep,
} from './blockedMountStepSeed';

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openHome: noop,
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openNewChat: noop,
  openConnections: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
};

type Props = {
  readonly seed?: () => void;
};

export const BlockedMountStepScene = ({ seed = seedBlockedMountStep }: Props) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const session = useSessionById(BLOCKED_MOUNT_SESSION_ID);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((current) => current.drawer !== null);

  useEffect(() => {
    seed();
    setIsSeeded(true);
  }, [seed]);

  if (!isSeeded || session === null) {
    return null;
  }

  return (
    <div data-shot className="flex h-screen min-h-0 bg-background text-foreground">
      <ShellLeft
        arrangement={shellArrangement({ hasWorkspace: true })}
        workspaceId={BLOCKED_MOUNT_WORKSPACE_ID}
        actions={ACTIONS}
      />
      <main className="relative flex min-w-0 flex-1">
        <DrawerColumn
          main={
            <SessionFrame session={session}>
              <SessionWorkspace session={session} />
            </SessionFrame>
          }
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          sizing={sizing}
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />
      </main>
    </div>
  );
};
