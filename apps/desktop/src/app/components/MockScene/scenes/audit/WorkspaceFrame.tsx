import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { AppTopBar } from '../../../AppTopBar';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { useAppStore } from '../../../../../store';
import { selectOpenDrawer } from '../../../../../store/slices/drawer/selectOpenDrawer';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { shellArrangement } from '../../../../shellArrangement';
import { useSceneShell } from '../useSceneShell';
import { useSceneSidebar } from '../useSceneSidebar';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

type Props = {
  readonly session: Session;
  readonly main?: ReactNode;
  readonly hasRail?: boolean;
};

export const WorkspaceFrame = ({ session, main, hasRail = true }: Props) => {
  const isDrawerOpen = useAppStore((state) => selectOpenDrawer(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const rail = useSceneSidebar({ isCollapsed: sceneParam({ key: 'rail' }) === '1' });
  const arrangement = shellArrangement({
    hasWorkspace: true,
    isSidebarCollapsed: rail.isCollapsed,
  });
  const shell = useSceneShell({ arrangement, onToggleSidebar: rail.toggle });
  return (
    <>
      <AppShell
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        drawerSizing={drawerSizing}
        studio={shell.studio}
        topBar={
          <AppTopBar
            sidebar={{ isCollapsed: arrangement.isLeftRail, onToggle: rail.toggle }}
            onOpenSpend={noop}
            onOpenScript={noop}
          />
        }
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={session.workspaceId}
            currentSessionId={hasRail ? session.id : null}
            isDraftShown={false}
            {...(!hasRail && { placeOverride: 'board' })}
            actions={shell.actions}
          />
        }
        main={
          hasRail ? (
            <SessionFrame session={session}>
              {main ?? <SessionWorkspace session={session} />}
            </SessionFrame>
          ) : (
            main
          )
        }
      />
      {shell.layers}
    </>
  );
};
