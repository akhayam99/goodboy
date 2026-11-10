import type { ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { FooterTarget } from '../../../hooks/useAppOverlays/overlayState';
import { AppTopBar } from '../../AppTopBar';
import { ShellLeft } from '../../SideColumn/ShellLeft';
import type { ColumnPlace } from '../../SideColumn/columnPlace';
import { ToastProvider } from '../../../../shared/components/Toast';
import { useAppStore } from '../../../../store';
import { shellArrangement } from '../../../shellArrangement';
import { sceneColumnPlace } from './sceneShell';
import { useSceneShell } from './useSceneShell';

const noop = () => undefined;

type StudioFrameProps = {
  readonly target: FooterTarget;
  readonly main: ReactNode;
  readonly columnPlace?: ColumnPlace;
  readonly currentSessionId?: SessionId | null;
};

export const StudioFrame = ({
  target,
  main,
  columnPlace,
  currentSessionId = null,
}: StudioFrameProps) => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const isSettingsOpen = useAppStore((state) => state.appStudio?.kind === 'settings');
  const arrangement = shellArrangement({ hasWorkspace: true, isSidebarCollapsed: false });
  const shell = useSceneShell({ arrangement });
  const place = columnPlace === undefined ? sceneColumnPlace({ target }) : columnPlace;

  return (
    <ToastProvider>
      <AppShell
        topBar={
          <AppTopBar
            sidebar={{ isCollapsed: arrangement.isLeftRail, onToggle: noop }}
            onOpenSpend={noop}
            onOpenScript={noop}
          />
        }
        leftSidebarCollapsed={arrangement.isLeftRail}
        leftSidebar={
          <ShellLeft
            arrangement={arrangement}
            workspaceId={workspaceId}
            currentSessionId={currentSessionId}
            isDraftShown={false}
            actions={shell.actions}
            {...(isSettingsOpen ? {} : { placeOverride: place })}
          />
        }
        main={main}
        {...(isSettingsOpen && { studio: shell.studio })}
      />
      {shell.layers}
    </ToastProvider>
  );
};
