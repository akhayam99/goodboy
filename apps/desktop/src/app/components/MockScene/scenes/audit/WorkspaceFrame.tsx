import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { AppTopBar } from '../../../AppTopBar';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { SceneFooter } from '../SceneFooter';
import { useSceneShell } from '../useSceneShell';
import { FRAME_CONNECTED } from './frameSeed';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

type Props = {
  readonly session: Session;
  readonly main?: ReactNode;
};

export const WorkspaceFrame = ({ session, main }: Props) => {
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const shell = useSceneShell({
    hasActiveSession: true,
    isSidebarCollapsed: sceneParam({ key: 'rail' }) === '1',
  });
  const { arrangement } = shell;
  return (
    <>
      <AppShell
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        drawerSizing={drawerSizing}
        studio={shell.studio}
        studioCoversLeft={arrangement.studioCoversLeft}
        topBar={
          <AppTopBar
            mode={arrangement.mode}
            onOpenSpend={noop}
            onOpenScript={noop}
            onOpenImpact={noop}
          />
        }
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={session.workspaceId}
            currentSessionId={session.id}
            isDraftShown={false}
            actions={shell.actions}
            onToggle={noop}
            settingsSlotRef={shell.settingsSlotRef}
          />
        }
        footer={
          arrangement.footer === null ? undefined : (
            <SceneFooter scope={arrangement.footer} connected={FRAME_CONNECTED} />
          )
        }
        main={
          main ?? (
            <div className="relative h-full w-full">
              <SessionWorkspace session={session} isActive />
            </div>
          )
        }
      />
      {shell.layers}
    </>
  );
};
