import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { AppTopBar } from '../../../AppTopBar';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { SessionFrame } from '../../../SessionRail/SessionFrame';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { shellArrangement } from '../../../../shellArrangement';
import { useSceneShell } from '../useSceneShell';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

type Props = {
  readonly session: Session;
  readonly main?: ReactNode;
  readonly hasRail?: boolean;
};

export const WorkspaceFrame = ({ session, main, hasRail = true }: Props) => {
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const drawerSizing = useAppStore(selectDrawerSizing);
  const arrangement = shellArrangement({
    hasWorkspace: true,
    isSidebarCollapsed: sceneParam({ key: 'rail' }) === '1',
  });
  const shell = useSceneShell({ arrangement });
  return (
    <>
      <AppShell
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        drawerSizing={drawerSizing}
        studio={shell.studio}
        studioCoversLeft={arrangement.studioCoversLeft}
        topBar={
          <AppTopBar
            sidebar={{ isCollapsed: arrangement.isLeftRail, onToggle: noop }}
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
            settingsSlotRef={shell.settingsSlotRef}
          />
        }
        main={
          hasRail ? (
            <SessionFrame session={session}>
              {main ?? <SessionWorkspace session={session} isActive />}
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
