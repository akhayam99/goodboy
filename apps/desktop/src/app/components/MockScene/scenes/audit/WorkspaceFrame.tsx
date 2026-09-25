import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { AppFooter } from '../../../AppFooter';
import { AppTopBar } from '../../../AppTopBar';
import { SessionNavSidebar } from '../../../../../features/session/components/SessionNavSidebar';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { shellArrangement } from '../../../../shellArrangement';
import { FRAME_CONNECTED } from './frameSeed';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

type Props = {
  readonly session: Session;
  readonly main?: ReactNode;
};

export const WorkspaceFrame = ({ session, main }: Props) => {
  const arrangement = shellArrangement({
    hasWorkspace: true,
    hasActiveSession: true,
    isSidebarCollapsed: sceneParam({ key: 'rail' }) === '1',
  });
  return (
    <AppShell
      topBar={
        <AppTopBar
          sidebar={{
            hasSidebar: arrangement.leftSlot !== 'none',
            isCollapsed: arrangement.leftSlot === 'rail',
            onToggle: noop,
          }}
          onOpenSpend={noop}
          onOpenScript={noop}
        />
      }
      leftHidden={arrangement.leftHidden}
      leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
      leftSidebar={
        arrangement.leftSlot === 'sessions' ? <SessionNavSidebar session={session} /> : undefined
      }
      footer={
        <AppFooter
          scope="workspace"
          target={null}
          connected={FRAME_CONNECTED}
          onOpenIntegration={noop}
          onOpenInbox={noop}
          onOpenWorkflows={noop}
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
