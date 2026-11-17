import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { AppTopBar } from '../../../AppTopBar';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { useShellRight } from '../../../../hooks/useShellRight';
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
  const shellRight = useShellRight({});
  const rail = useSceneSidebar({ isCollapsed: sceneParam({ key: 'rail' }) === '1' });
  const arrangement = shellArrangement({
    hasWorkspace: true,
    isSidebarCollapsed: rail.isCollapsed,
  });
  const shell = useSceneShell({ arrangement, onToggleSidebar: rail.toggle });
  return (
    <>
      <AppShell
        drawer={shellRight.isDrawerMounted ? <DrawerHost slot="dock" /> : null}
        drawerSizing={shellRight.dockSizing}
        detail={shellRight.isDetailMounted ? <DrawerHost slot="detail" /> : null}
        detailSizing={shellRight.detailSizing}
        isDrawerParked={shellRight.isDrawerParked}
        isDetailParked={shellRight.isDetailParked}
        rightRail={shellRight.rightRail}
        studio={shell.studio}
        isDockInStudio={shellRight.isDockInStudio}
        topBar={<AppTopBar onOpenSpend={noop} onOpenScript={noop} />}
        leftRail={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={session.workspaceId}
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
