import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { AppFooter } from '../../../AppFooter';
import { AppTopBar } from '../../../AppTopBar';
import { SessionNavSidebar } from '../../../../../features/session/components/SessionNavSidebar';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { shellArrangement } from '../../../../shellArrangement';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
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
  const arrangement = shellArrangement({
    hasWorkspace: true,
    hasActiveSession: true,
    isSidebarCollapsed: sceneParam({ key: 'rail' }) === '1',
  });
  return (
    <AppShell
      topBar={<AppTopBar onOpenSpend={noop} onOpenScript={noop} />}
      drawer={isDrawerOpen ? <DrawerHost /> : null}
      drawerSizing={drawerSizing}
      leftHidden={arrangement.leftHidden}
      leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
      leftSidebar={
        arrangement.leftSlot === 'sessions' ? (
          <SessionNavSidebar currentSessionId={session.id} />
        ) : undefined
      }
      footer={
        <AppFooter
          scope="workspace"
          target={{ place: null, tool: null }}
          connected={FRAME_CONNECTED}
          onOpenIntegration={noop}
          onOpenInbox={noop}
          onOpenWorkflows={noop}
          onOpenImpact={noop}
          onOpenSettings={noop}
          onOpenShortcuts={noop}
          onOpenChangelog={noop}
        />
      }
      main={
        main ?? (
          <div className="relative h-full w-full">
            <SessionWorkspace session={session} isActive />
          </div>
        )
      }
    />
  );
};
