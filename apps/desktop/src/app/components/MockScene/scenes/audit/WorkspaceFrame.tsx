import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { AppTopBar } from '../../../AppTopBar';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { shellArrangement } from '../../../../shellArrangement';
import { SceneFooter } from '../SceneFooter';
import { SCENE_COLUMN_ACTIONS, sceneShellMode } from '../sceneShell';
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
    mode: sceneShellMode(),
  });
  return (
    <AppShell
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
          actions={SCENE_COLUMN_ACTIONS}
          onToggle={noop}
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
  );
};
